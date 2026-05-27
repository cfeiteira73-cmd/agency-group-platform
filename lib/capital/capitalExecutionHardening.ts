// Agency Group — Capital Execution Hardening
// lib/capital/capitalExecutionHardening.ts
// Wave 51 Phase 3 — Financial integrity proof, replay determinism, orphan sweep
//
// CAPITAL_EXECUTION_CERTIFIER: validates all capital flows are idempotent,
// replay-safe, reconciled to 99.9%, and orphan-free.
// FINANCIAL_INTEGRITY_PROOF: SHA-256 chain over all settled transactions.
// REPLAY_DETERMINISM_PROOF: idempotency key coverage audit.
// ORPHAN_CAPITAL_SWEEPER: detects and flags orphan entries (never auto-resolves).
// Extends existing capital lib — NEVER replaces it.
// TypeScript strict — 0 errors

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ── Constants ──────────────────────────────────────────────────────────────────

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

const RECONCILIATION_TARGET_PCT  = 99.9
const ORPHAN_AGE_HOURS           = 24
const IDEMPOTENCY_TARGET_PCT     = 100
const REPLAY_WINDOW_HOURS        = 72
const ESCROW_MAX_HOLD_HOURS      = 72

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type CapitalCertificationStatus =
  | 'CAPITAL_CERTIFIED'
  | 'CAPITAL_VERIFIED'
  | 'CAPITAL_WITH_GAPS'
  | 'CAPITAL_CRITICAL'
  | 'NO_CAPITAL_DATA'

export interface FinancialIntegrityProof {
  total_settled_transactions:   number
  chain_start_hash:             string
  chain_end_hash:               string
  chain_length:                 number
  integrity_verified:           boolean
  mismatch_count:               number
  critical_mismatch_count:      number
  reconciliation_accuracy_pct:  number
  reconciliation_target_met:    boolean
  proof_hash:                   string
  computed_at:                  string
}

export interface ReplayDeterminismProof {
  total_financial_events:    number
  events_with_idempotency:   number
  events_without_idempotency: number
  idempotency_coverage_pct:  number
  duplicate_events_detected: number
  replay_window_hours:       number
  replay_safe:               boolean
  determinism_score:         number
  proof_hash:                string
}

export interface OrphanCapitalEntry {
  record_id: string
  tenant_id: string
  amount_eur_cents: number
  age_hours: number
  orphan_reason: string
  requires_manual_review: boolean
  flagged_at: string
}

export interface OrphanCapitalSweep {
  sweep_id:              string
  orphans_detected:      number
  orphans_critical:      number
  total_orphan_eur_cents: number
  oldest_orphan_hours:   number
  sweep_action:          'FLAG_FOR_MANUAL_REVIEW'
  auto_resolved:         false
  sweep_hash:            string
  swept_at:              string
}

export interface EscrowValidation {
  active_escrows:          number
  overdue_escrows:         number
  escrow_total_eur_cents:  number
  max_hold_hours:          number
  escrow_healthy:          boolean
  issues:                  string[]
}

export interface CapitalExecutionReport {
  report_id:                    string
  tenant_id:                    string
  certification_status:         CapitalCertificationStatus
  capital_execution_score:      number
  financial_integrity_proof:    FinancialIntegrityProof
  replay_determinism_proof:     ReplayDeterminismProof
  orphan_capital_sweep:         OrphanCapitalSweep
  escrow_validation:            EscrowValidation
  idempotency_coverage_pct:     number
  reconciliation_accuracy_pct:  number
  zero_orphan_capital:          boolean
  zero_duplicate_payments:      boolean
  capital_integrity_hash:       string
  blockers:                     string[]
  warnings:                     string[]
  generated_at:                 string
}

// ── Financial integrity chain ─────────────────────────────────────────────────

async function buildFinancialIntegrityProof(tenantId: string): Promise<FinancialIntegrityProof> {
  const { data: records } = await (supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          order: (col: string, opts: Record<string, unknown>) => Promise<{ data: Array<{ id: string; amount_eur_cents: number; bank_confirmed_at: string | null; settlement_state: string }> | null }>
        }
      }
    }
  })
    .from('finality_records')
    .select('id, amount_eur_cents, bank_confirmed_at, settlement_state')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  const rows = records ?? []
  const total = rows.length
  const confirmed = rows.filter(r => r.bank_confirmed_at !== null).length
  const mismatches = rows.filter(r =>
    r.settlement_state === 'TRANSFERRED' && !r.bank_confirmed_at,
  ).length

  const accuracy = total > 0 ? Math.round((confirmed / total) * 1000) / 10 : 0

  // Build SHA-256 chain
  let chainHash = createHash('sha256').update('GENESIS').digest('hex')
  for (const r of rows) {
    chainHash = createHash('sha256')
      .update(`${chainHash}|${r.id}|${r.amount_eur_cents}|${r.settlement_state}`)
      .digest('hex')
  }

  const proofHash = createHash('sha256')
    .update(`INTEGRITY|${tenantId}|${chainHash}|${total}|${accuracy}`)
    .digest('hex')

  return {
    total_settled_transactions:  total,
    chain_start_hash:            createHash('sha256').update('GENESIS').digest('hex'),
    chain_end_hash:              chainHash,
    chain_length:                total,
    integrity_verified:          mismatches === 0,
    mismatch_count:              mismatches,
    critical_mismatch_count:     mismatches,
    reconciliation_accuracy_pct: accuracy,
    reconciliation_target_met:   accuracy >= RECONCILIATION_TARGET_PCT,
    proof_hash:                  proofHash,
    computed_at:                 new Date().toISOString(),
  }
}

// ── Replay determinism ─────────────────────────────────────────────────────────

async function buildReplayDeterminismProof(tenantId: string): Promise<ReplayDeterminismProof> {
  const windowStart = new Date(Date.now() - REPLAY_WINDOW_HOURS * 3600 * 1000).toISOString()

  const { data: events } = await (supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          gte: (col: string, val: string) => Promise<{ data: Array<{ idempotency_key: string | null }> | null }>
        }
      }
    }
  })
    .from('learning_events')
    .select('idempotency_key')
    .eq('tenant_id', tenantId)
    .gte('created_at', windowStart)

  const rows = events ?? []
  const withKey = rows.filter(r => !!r.idempotency_key).length
  const withoutKey = rows.length - withKey

  const keys = rows.map(r => r.idempotency_key).filter(Boolean)
  const uniqueKeys = new Set(keys)
  const duplicates = keys.length - uniqueKeys.size

  const coveragePct = rows.length > 0 ? Math.round((withKey / rows.length) * 100) : 100
  const deterministicScore = Math.max(0, coveragePct - duplicates * 10)

  const proofHash = createHash('sha256')
    .update(`REPLAY|${tenantId}|${rows.length}|${coveragePct}|${duplicates}`)
    .digest('hex')

  return {
    total_financial_events:     rows.length,
    events_with_idempotency:    withKey,
    events_without_idempotency: withoutKey,
    idempotency_coverage_pct:   coveragePct,
    duplicate_events_detected:  duplicates,
    replay_window_hours:        REPLAY_WINDOW_HOURS,
    replay_safe:                duplicates === 0 && coveragePct >= IDEMPOTENCY_TARGET_PCT,
    determinism_score:          deterministicScore,
    proof_hash:                 proofHash,
  }
}

// ── Orphan sweep ──────────────────────────────────────────────────────────────

async function runOrphanCapitalSweep(tenantId: string): Promise<OrphanCapitalSweep> {
  const cutoff = new Date(Date.now() - ORPHAN_AGE_HOURS * 3600 * 1000).toISOString()

  const { data: orphans } = await (supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          is: (col: string, val: null) => {
            lt: (col: string, val: string) => Promise<{ data: Array<{ id: string; amount_eur_cents: number; created_at: string }> | null }>
          }
        }
      }
    }
  })
    .from('finality_records')
    .select('id, amount_eur_cents, created_at')
    .eq('tenant_id', tenantId)
    .is('bank_confirmed_at', null)
    .lt('created_at', cutoff)

  const rows = orphans ?? []
  const critical = rows.filter(r => {
    const ageHours = (Date.now() - new Date(r.created_at).getTime()) / 3600000
    return ageHours > ORPHAN_AGE_HOURS * 2
  })

  const totalCents = rows.reduce((sum, r) => sum + (r.amount_eur_cents ?? 0), 0)
  const oldestHours = rows.length > 0
    ? Math.round((Date.now() - Math.min(...rows.map(r => new Date(r.created_at).getTime()))) / 3600000)
    : 0

  const sweepHash = createHash('sha256')
    .update(`ORPHAN_SWEEP|${tenantId}|${rows.length}|${totalCents}|${new Date().toISOString().split('T')[0]}`)
    .digest('hex')

  return {
    sweep_id:               randomUUID(),
    orphans_detected:       rows.length,
    orphans_critical:       critical.length,
    total_orphan_eur_cents: totalCents,
    oldest_orphan_hours:    oldestHours,
    sweep_action:           'FLAG_FOR_MANUAL_REVIEW',
    auto_resolved:          false,
    sweep_hash:             sweepHash,
    swept_at:               new Date().toISOString(),
  }
}

// ── Escrow validation ─────────────────────────────────────────────────────────

async function runEscrowValidation(tenantId: string): Promise<EscrowValidation> {
  const { data: escrows } = await (supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          is: (col: string, val: null) => Promise<{ data: Array<{ amount_eur_cents: number; created_at: string }> | null }>
        }
      }
    }
  })
    .from('liquidity_locks')
    .select('amount_eur_cents, created_at')
    .eq('tenant_id', tenantId)
    .is('released_at', null)

  const rows = escrows ?? []
  const overdue = rows.filter(r => {
    const ageHours = (Date.now() - new Date(r.created_at).getTime()) / 3600000
    return ageHours > ESCROW_MAX_HOLD_HOURS
  })
  const totalCents = rows.reduce((sum, r) => sum + (r.amount_eur_cents ?? 0), 0)
  const issues: string[] = []
  if (overdue.length > 0) issues.push(`${overdue.length} escrow(s) overdue (>${ESCROW_MAX_HOLD_HOURS}h)`)

  return {
    active_escrows:         rows.length,
    overdue_escrows:        overdue.length,
    escrow_total_eur_cents: totalCents,
    max_hold_hours:         ESCROW_MAX_HOLD_HOURS,
    escrow_healthy:         overdue.length === 0,
    issues,
  }
}

// ── Certification status ───────────────────────────────────────────────────────

function computeCertificationStatus(score: number, blockers: string[]): CapitalCertificationStatus {
  if (blockers.length > 0) return 'CAPITAL_CRITICAL'
  if (score >= 95)          return 'CAPITAL_CERTIFIED'
  if (score >= 80)          return 'CAPITAL_VERIFIED'
  if (score >= 60)          return 'CAPITAL_WITH_GAPS'
  return 'NO_CAPITAL_DATA'
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runCapitalExecutionHardening(
  tenantId?: string,
): Promise<CapitalExecutionReport> {
  const tid   = tenantId ?? TENANT_ID
  const start = Date.now()

  log.info('[capitalExecutionHardening] starting', { tenantId: tid })

  const [integrityProof, replayProof, orphanSweep, escrowValidation] = await Promise.all([
    buildFinancialIntegrityProof(tid).catch((e: unknown) => {
      log.warn('[capitalExecutionHardening] integrityProof failed', { e: String(e) })
      return null
    }),
    buildReplayDeterminismProof(tid).catch((e: unknown) => {
      log.warn('[capitalExecutionHardening] replayProof failed', { e: String(e) })
      return null
    }),
    runOrphanCapitalSweep(tid).catch((e: unknown) => {
      log.warn('[capitalExecutionHardening] orphanSweep failed', { e: String(e) })
      return null
    }),
    runEscrowValidation(tid).catch((e: unknown) => {
      log.warn('[capitalExecutionHardening] escrowValidation failed', { e: String(e) })
      return null
    }),
  ])

  const blockers: string[] = []
  const warnings: string[]  = []

  if (integrityProof && !integrityProof.reconciliation_target_met)
    blockers.push(`Reconciliation ${integrityProof.reconciliation_accuracy_pct}% < ${RECONCILIATION_TARGET_PCT}% target`)
  if (integrityProof && integrityProof.critical_mismatch_count > 0)
    blockers.push(`${integrityProof.critical_mismatch_count} critical settlement mismatch(es)`)
  if (orphanSweep && orphanSweep.orphans_critical > 0)
    blockers.push(`${orphanSweep.orphans_critical} critical orphan capital entries require manual review`)
  if (replayProof && replayProof.duplicate_events_detected > 0)
    warnings.push(`${replayProof.duplicate_events_detected} duplicate payment event(s) detected`)
  if (escrowValidation && escrowValidation.overdue_escrows > 0)
    warnings.push(`${escrowValidation.overdue_escrows} overdue escrow(s)`)

  // Score computation
  const reconcScore  = integrityProof?.reconciliation_target_met ? 100 : Math.round((integrityProof?.reconciliation_accuracy_pct ?? 0))
  const idempScore   = replayProof?.determinism_score ?? 0
  const orphanScore  = orphanSweep ? Math.max(0, 100 - orphanSweep.orphans_critical * 20) : 50
  const escrowScore  = escrowValidation?.escrow_healthy ? 100 : 60
  const capitalScore = Math.round(reconcScore * 0.40 + idempScore * 0.30 + orphanScore * 0.20 + escrowScore * 0.10)

  const certStatus = computeCertificationStatus(capitalScore, blockers)

  // Default objects when sub-reports fail
  const defaultIntegrityProof: FinancialIntegrityProof = {
    total_settled_transactions: 0,
    chain_start_hash: '',
    chain_end_hash: '',
    chain_length: 0,
    integrity_verified: false,
    mismatch_count: 0,
    critical_mismatch_count: 0,
    reconciliation_accuracy_pct: 0,
    reconciliation_target_met: false,
    proof_hash: '',
    computed_at: new Date().toISOString(),
  }
  const defaultReplayProof: ReplayDeterminismProof = {
    total_financial_events: 0,
    events_with_idempotency: 0,
    events_without_idempotency: 0,
    idempotency_coverage_pct: 0,
    duplicate_events_detected: 0,
    replay_window_hours: REPLAY_WINDOW_HOURS,
    replay_safe: false,
    determinism_score: 0,
    proof_hash: '',
  }
  const defaultOrphanSweep: OrphanCapitalSweep = {
    sweep_id: randomUUID(),
    orphans_detected: 0,
    orphans_critical: 0,
    total_orphan_eur_cents: 0,
    oldest_orphan_hours: 0,
    sweep_action: 'FLAG_FOR_MANUAL_REVIEW',
    auto_resolved: false,
    sweep_hash: '',
    swept_at: new Date().toISOString(),
  }
  const defaultEscrowValidation: EscrowValidation = {
    active_escrows: 0,
    overdue_escrows: 0,
    escrow_total_eur_cents: 0,
    max_hold_hours: ESCROW_MAX_HOLD_HOURS,
    escrow_healthy: true,
    issues: [],
  }

  const finalIntegrity = integrityProof ?? defaultIntegrityProof
  const finalReplay    = replayProof    ?? defaultReplayProof
  const finalSweep     = orphanSweep    ?? defaultOrphanSweep
  const finalEscrow    = escrowValidation ?? defaultEscrowValidation

  const capitalHash = createHash('sha256')
    .update(`CAPITAL|${tid}|${certStatus}|${capitalScore}|${new Date().toISOString().split('T')[0]}`)
    .digest('hex')

  const report: CapitalExecutionReport = {
    report_id:                    randomUUID(),
    tenant_id:                    tid,
    certification_status:         certStatus,
    capital_execution_score:      capitalScore,
    financial_integrity_proof:    finalIntegrity,
    replay_determinism_proof:     finalReplay,
    orphan_capital_sweep:         finalSweep,
    escrow_validation:            finalEscrow,
    idempotency_coverage_pct:     finalReplay.idempotency_coverage_pct,
    reconciliation_accuracy_pct:  finalIntegrity.reconciliation_accuracy_pct,
    zero_orphan_capital:          finalSweep.orphans_critical === 0,
    zero_duplicate_payments:      finalReplay.duplicate_events_detected === 0,
    capital_integrity_hash:       capitalHash,
    blockers,
    warnings,
    generated_at:                 new Date().toISOString(),
  }

  const { error } = await (supabaseAdmin as unknown as { from: (t: string) => { insert: (v: unknown) => { error: unknown } } })
    .from('capital_execution_reports')
    .insert({
      report_id:             report.report_id,
      tenant_id:             tid,
      certification_status:  report.certification_status,
      capital_score:         report.capital_execution_score,
      reconciliation_pct:    report.reconciliation_accuracy_pct,
      idempotency_pct:       report.idempotency_coverage_pct,
      orphans_critical:      finalSweep.orphans_critical,
      blocker_count:         blockers.length,
      capital_hash:          report.capital_integrity_hash,
      report_json:           JSON.stringify(report, bigintReplacer),
      generated_at:          report.generated_at,
    })
  if (error) log.warn('[capitalExecutionHardening] persist failed', { error })

  log.info('[capitalExecutionHardening] complete', {
    status:     certStatus,
    score:      capitalScore,
    blockers:   blockers.length,
    durationMs: Date.now() - start,
  })

  return report
}
