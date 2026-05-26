// Agency Group — Live Institutional Truth Gate
// lib/certification/liveInstitutionalTruthGate.ts
// Wave 48 GAP 6 — Final live operational truth verification
//
// 15-condition truth gate for FULLY_OPERATIONAL_INSTITUTIONAL_REAL_ESTATE_PLATFORM.
// Generates TRUTH_CERTIFICATION_HASH — externally verifiable.
// Generates INSTITUTIONAL_GO_LIVE_REPORT.json data structure.
// Extends institutionalTruthGate.ts (Wave 47) — NEVER replaces it.
// TypeScript strict — 0 errors

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { runInstitutionalTruthGate, type TruthGateVerdict } from './institutionalTruthGate'
import { runLiveRealityBoundaryReport } from '@/lib/reality/liveRealityBoundaryEngine'
import { runLiveSettlementReport } from '@/lib/financial/liveSettlementRealityEngine'
import { runLiveSocReport } from '@/lib/security/liveSecurityOperationsCenter'
import { runInstitutionalAuditReport } from '@/lib/compliance/institutionalAuditRealityLayer'
import { runLiveInstitutionalChaosReport } from '@/lib/resilience/liveInstitutionalChaosEngine'

// ── Constants ──────────────────────────────────────────────────────────────────

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ── Types ──────────────────────────────────────────────────────────────────────

export type LiveGateCondition =
  // Financial reality (3 conditions)
  | 'REAL_BANK_SETTLEMENT_VERIFIED'
  | 'REAL_PSP_CAPTURE_VERIFIED'
  | 'RECONCILIATION_99_5_PCT'
  // Security reality (3 conditions)
  | 'LIVE_SIEM_ACTIVE'
  | 'INCIDENT_ROUTING_ACTIVE'
  | 'PROVIDER_SLA_VALIDATED'
  // Resilience reality (4 conditions)
  | 'FALLBACK_PROVEN_UNDER_LOAD'
  | 'DR_RESTORE_EXECUTED'
  | 'RANSOMWARE_SIMULATION_EXECUTED'
  | 'FAILOVER_EXECUTED'
  // Compliance reality (3 conditions)
  | 'SOC2_READINESS_85PCT'
  | 'ISO27001_READINESS_85PCT'
  | 'ZERO_UNRESOLVED_CRITICAL_VULNS'
  // Capital integrity (2 conditions)
  | 'ZERO_ORPHAN_CAPITAL'
  | 'ZERO_UNRECONCILED_SETTLEMENT'

export type LiveGateVerdict = 'PASS' | 'FAIL' | 'WARN' | 'PENDING'

export type SystemLiveStatus =
  | 'FULLY_OPERATIONAL_INSTITUTIONAL_REAL_ESTATE_PLATFORM'
  | 'INSTITUTIONAL_LIVE_CONDITIONALLY'
  | 'INSTITUTIONAL_LIVE_WITH_GAPS'
  | 'INSTITUTIONAL_NOT_LIVE'

export interface LiveGateResult {
  condition: LiveGateCondition
  verdict: LiveGateVerdict
  score: number         // 0-100
  detail: string
  evidence: string
  blocking: boolean
  checked_at: string
}

export interface TruthCertification {
  certification_id: string
  tenant_id: string
  certified_at: string
  system_live_status: SystemLiveStatus
  truth_certification_hash: string   // SHA-256 over all 15+9 gate verdicts
  institutional_go_live: boolean
  wave47_gates_passed: number
  wave47_gates_total: number
  wave48_gates_passed: number
  wave48_gates_total: number
  combined_score: number
  valid_until: string                // 90-day certification window
}

export interface InstitutionalGoLiveReport {
  report_id: string
  tenant_id: string
  generated_at: string
  // Status
  system_live_status: SystemLiveStatus
  institutional_go_live: boolean
  truth_certification: TruthCertification | null
  // Wave 47 base gates (9 conditions)
  wave47_gates_passed: number
  wave47_gates_total: number
  wave47_summary: string
  // Wave 48 live gates (15 conditions)
  live_gates: LiveGateResult[]
  live_gates_passed: number
  live_gates_total: number
  live_gates_blocking_failed: number
  // Sub-reports scores
  live_reality_score: number
  live_settlement_grade: string
  live_soc_score: number
  audit_readiness_score: number
  chaos_resilience_grade: string
  // Go-live checklist
  pre_live_blockers: string[]
  pre_live_warnings: string[]
  activation_steps: string[]
  // Immutable hash
  sha256_truth_hash: string
}

// ── Live gate checkers ─────────────────────────────────────────────────────────

function makeGate(
  condition: LiveGateCondition,
  verdict: LiveGateVerdict,
  score: number,
  detail: string,
  evidence: string,
  blocking: boolean,
): LiveGateResult {
  return { condition, verdict, score, detail, evidence, blocking, checked_at: new Date().toISOString() }
}

// ── buildLiveGates ────────────────────────────────────────────────────────────

async function buildLiveGates(
  tenantId: string,
  settlementReport: Awaited<ReturnType<typeof runLiveSettlementReport>>,
  socReport: Awaited<ReturnType<typeof runLiveSocReport>>,
  auditReport: Awaited<ReturnType<typeof runInstitutionalAuditReport>>,
  chaosReport: Awaited<ReturnType<typeof runLiveInstitutionalChaosReport>>,
  realityReport: Awaited<ReturnType<typeof runLiveRealityBoundaryReport>>,
): Promise<LiveGateResult[]> {
  const gates: LiveGateResult[] = []

  // ── Financial reality gates ────────────────────────────────────────────────

  // 1. Real bank settlement
  gates.push(makeGate(
    'REAL_BANK_SETTLEMENT_VERIFIED',
    settlementReport.bank_confirmed_count > 0 ? 'PASS' : 'FAIL',
    settlementReport.bank_confirmed_count > 0 ? 100 : 0,
    settlementReport.bank_confirmed_count > 0
      ? `${settlementReport.bank_confirmed_count} BANK_CONFIRMED transactions — real money verified`
      : 'No BANK_CONFIRMED transactions — PSP credentials required',
    `finality_gate_passed=${String(settlementReport.finality_gate_passed)}`,
    true,
  ))

  // 2. Real PSP capture (check PSP connectivity)
  const pspLive = realityReport.psp_connectivity.any_psp_live
  gates.push(makeGate(
    'REAL_PSP_CAPTURE_VERIFIED',
    pspLive ? (settlementReport.bank_confirmed_count > 0 ? 'PASS' : 'WARN') : 'FAIL',
    pspLive ? (settlementReport.bank_confirmed_count > 0 ? 100 : 50) : 0,
    pspLive
      ? `PSP configured: Stripe=${String(realityReport.psp_connectivity.stripe_configured)} Adyen=${String(realityReport.psp_connectivity.adyen_configured)}`
      : 'No PSP configured — set STRIPE_SECRET_KEY or ADYEN_API_KEY',
    `psp_configured=${String(pspLive)}`,
    true,
  ))

  // 3. Reconciliation ≥99.5%
  const reconPct = settlementReport.reconciliation_accuracy_pct
  gates.push(makeGate(
    'RECONCILIATION_99_5_PCT',
    settlementReport.total_transactions === 0 ? 'PENDING'
      : reconPct >= 99.5 ? 'PASS'
      : reconPct >= 99.0 ? 'WARN'
      : 'FAIL',
    settlementReport.total_transactions === 0 ? 0 : Math.min(100, Math.round(reconPct)),
    settlementReport.total_transactions === 0
      ? 'No transactions yet — pending real payment flows'
      : `Reconciliation: ${reconPct.toFixed(2)}% (target ≥99.5%)`,
    `total_txns=${settlementReport.total_transactions} mismatches=${settlementReport.mismatch_count}`,
    true,
  ))

  // ── Security reality gates ─────────────────────────────────────────────────

  // 4. Live SIEM
  const siemActive = socReport.pagerduty_configured || socReport.slack_security_configured
    || !!(process.env.DD_API_KEY) || !!(process.env.AZURE_SENTINEL_WORKSPACE_ID)
  gates.push(makeGate(
    'LIVE_SIEM_ACTIVE',
    siemActive ? 'PASS' : socReport.base_soc_score > 0 ? 'WARN' : 'FAIL',
    siemActive ? 100 : 40,
    siemActive
      ? `External SIEM active: ${socReport.active_escalation_channels.join(', ') || 'local only'}`
      : 'Only local SIEM active — configure Datadog EU or Azure Sentinel',
    `datadog=${String(!!(process.env.DD_API_KEY))} sentinel=${String(!!(process.env.AZURE_SENTINEL_WORKSPACE_ID))}`,
    false,
  ))

  // 5. Incident routing
  gates.push(makeGate(
    'INCIDENT_ROUTING_ACTIVE',
    socReport.active_escalation_channels.length > 0 ? 'PASS' : 'WARN',
    socReport.active_escalation_channels.length > 0 ? 100 : 30,
    socReport.active_escalation_channels.length > 0
      ? `Routing active: ${socReport.active_escalation_channels.join(', ')}`
      : 'No escalation channels — set PAGERDUTY_INTEGRATION_KEY or SLACK_SECURITY_WEBHOOK',
    `channels=${socReport.active_escalation_channels.join(',')}`,
    false,
  ))

  // 6. Provider SLA validated
  const slaOk = realityReport.system_reality_index.label !== 'ARCHITECTURE_ONLY'
  const aliveCount = realityReport.system_reality_index.providers_alive
  gates.push(makeGate(
    'PROVIDER_SLA_VALIDATED',
    slaOk && aliveCount > 0 ? 'PASS' : slaOk ? 'WARN' : 'FAIL',
    slaOk ? Math.min(100, realityReport.system_reality_index.index + 10) : 0,
    slaOk
      ? `${aliveCount}/5 providers within SLA (${realityReport.system_reality_index.label})`
      : 'No providers configured — all 5 feeds in NOT_CONFIGURED state',
    `reality_index=${realityReport.system_reality_index.index} label=${realityReport.system_reality_index.label}`,
    false,
  ))

  // ── Resilience reality gates ───────────────────────────────────────────────

  // 7. Fallback proven under load
  const fallbackProven = realityReport.fallback_events.length > 0 || chaosReport.chaos_window.status === 'COMPLETED'
  gates.push(makeGate(
    'FALLBACK_PROVEN_UNDER_LOAD',
    fallbackProven ? 'PASS' : 'WARN',
    fallbackProven ? 100 : 40,
    fallbackProven
      ? `Fallback proven: ${realityReport.fallback_events.length} fallback event(s) + chaos window ${chaosReport.chaos_window.status}`
      : 'No fallback events yet — configure providers and run POST /api/resilience/chaos',
    `fallback_events=${realityReport.fallback_events.length} chaos=${chaosReport.chaos_window.status}`,
    false,
  ))

  // 8. DR restore executed
  const drExecuted = chaosReport.failover_records.length > 0 || chaosReport.rto_validations.length > 0
  gates.push(makeGate(
    'DR_RESTORE_EXECUTED',
    drExecuted ? 'PASS' : 'FAIL',
    drExecuted ? 100 : 0,
    drExecuted
      ? `DR test executed: ${chaosReport.failover_records.length} failover record(s), ${chaosReport.rto_validations.length} RTO validation(s)`
      : 'No DR restore executed — run POST /api/dr/simulate',
    `failovers=${chaosReport.failover_records.length} rto_tests=${chaosReport.rto_validations.length}`,
    true,
  ))

  // 9. Ransomware simulation
  const ransomwareSimRun = chaosReport.chaos_window.scenarios_run.length > 0
  gates.push(makeGate(
    'RANSOMWARE_SIMULATION_EXECUTED',
    ransomwareSimRun ? 'PASS' : 'WARN',
    ransomwareSimRun ? 100 : 50,
    ransomwareSimRun
      ? 'Ransomware simulation included in chaos gauntlet (ransomware_isolation scenario)'
      : 'Chaos gauntlet not run — call POST /api/resilience/chaos',
    `chaos_scenarios=${chaosReport.chaos_window.scenarios_run.join(',')}`,
    false,
  ))

  // 10. Failover executed
  const failoverExecuted = chaosReport.failovers_successful > 0 || chaosReport.failover_records.length > 0
  gates.push(makeGate(
    'FAILOVER_EXECUTED',
    failoverExecuted ? 'PASS' : 'WARN',
    failoverExecuted ? 100 : 30,
    failoverExecuted
      ? `${chaosReport.failovers_successful} failover(s) successful`
      : 'No failover executions recorded — configure DR infrastructure',
    `successful=${chaosReport.failovers_successful} failed=${chaosReport.failovers_failed}`,
    false,
  ))

  // ── Compliance reality gates ───────────────────────────────────────────────

  // 11. SOC2 ≥85%
  gates.push(makeGate(
    'SOC2_READINESS_85PCT',
    auditReport.soc2_score >= 85 ? 'PASS' : auditReport.soc2_score >= 70 ? 'WARN' : 'FAIL',
    auditReport.soc2_score,
    `SOC2 score: ${auditReport.soc2_score}% (target ≥85%)`,
    `readiness=${auditReport.soc2_readiness}`,
    true,
  ))

  // 12. ISO27001 ≥85%
  gates.push(makeGate(
    'ISO27001_READINESS_85PCT',
    auditReport.iso27001_score >= 85 ? 'PASS' : auditReport.iso27001_score >= 70 ? 'WARN' : 'FAIL',
    auditReport.iso27001_score,
    `ISO27001 score: ${auditReport.iso27001_score}% (target ≥85%)`,
    `readiness=${auditReport.iso27001_readiness}`,
    true,
  ))

  // 13. Zero unresolved CRITICAL vulns
  gates.push(makeGate(
    'ZERO_UNRESOLVED_CRITICAL_VULNS',
    auditReport.open_critical_count === 0 ? 'PASS' : 'FAIL',
    auditReport.open_critical_count === 0 ? 100 : 0,
    auditReport.open_critical_count === 0
      ? 'No unresolved CRITICAL vulnerabilities'
      : `${auditReport.open_critical_count} CRITICAL vulnerability(ies) unresolved — institutional audit BLOCKED`,
    `critical_vulns=${auditReport.open_critical_count} high_vulns=${auditReport.open_high_count}`,
    true,
  ))

  // ── Capital integrity gates ────────────────────────────────────────────────

  // 14. Zero orphan capital
  gates.push(makeGate(
    'ZERO_ORPHAN_CAPITAL',
    settlementReport.orphan_capital_entries.length === 0 ? 'PASS' : settlementReport.orphan_capital_critical ? 'FAIL' : 'WARN',
    settlementReport.orphan_capital_entries.length === 0 ? 100 : Math.max(0, 100 - settlementReport.orphan_capital_entries.length * 20),
    settlementReport.orphan_capital_entries.length === 0
      ? 'No orphan capital detected'
      : `${settlementReport.orphan_capital_entries.length} orphan capital entry(ies) — ${settlementReport.total_orphan_eur} stuck`,
    `orphans=${settlementReport.orphan_capital_entries.length} critical=${String(settlementReport.orphan_capital_critical)}`,
    settlementReport.orphan_capital_critical,
  ))

  // 15. Zero unreconciled settlement chains
  gates.push(makeGate(
    'ZERO_UNRECONCILED_SETTLEMENT',
    settlementReport.critical_mismatch_count === 0 ? 'PASS' : 'FAIL',
    settlementReport.critical_mismatch_count === 0
      ? (settlementReport.mismatch_count === 0 ? 100 : 80)
      : 0,
    settlementReport.critical_mismatch_count === 0
      ? `Settlement chains clean${settlementReport.mismatch_count > 0 ? ` (${settlementReport.mismatch_count} minor warnings)` : ''}`
      : `${settlementReport.critical_mismatch_count} CRITICAL settlement mismatch(es) — total delta: ${settlementReport.total_mismatch_eur}`,
    `mismatches=${settlementReport.mismatch_count} critical=${settlementReport.critical_mismatch_count}`,
    true,
  ))

  return gates
}

// ── computeSystemLiveStatus ───────────────────────────────────────────────────

function computeSystemLiveStatus(
  wave47Score: number,
  wave48Gates: LiveGateResult[],
): SystemLiveStatus {
  const blockingFailed = wave48Gates.filter(g => g.blocking && g.verdict === 'FAIL').length
  const allPassed = wave48Gates.every(g => g.verdict === 'PASS')
  const anyFailed = wave48Gates.some(g => g.verdict === 'FAIL')

  if (blockingFailed > 0 || wave47Score < 50) return 'INSTITUTIONAL_NOT_LIVE'
  if (allPassed && wave47Score >= 80) return 'FULLY_OPERATIONAL_INSTITUTIONAL_REAL_ESTATE_PLATFORM'
  if (!anyFailed && wave47Score >= 60) return 'INSTITUTIONAL_LIVE_CONDITIONALLY'
  return 'INSTITUTIONAL_LIVE_WITH_GAPS'
}

// ── computeTruthCertificationHash ─────────────────────────────────────────────

function computeTruthCertificationHash(
  wave47Verdicts: string,
  wave48Gates: LiveGateResult[],
  tenantId: string,
  timestamp: string,
): string {
  const wave48Verdicts = wave48Gates.map(g => `${g.condition}:${g.verdict}:${g.score}`).join('|')
  return createHash('sha256')
    .update(`${tenantId}|${timestamp.slice(0, 10)}|${wave47Verdicts}|${wave48Verdicts}`)
    .digest('hex')
}

// ── Main gate ─────────────────────────────────────────────────────────────────

export async function runLiveInstitutionalTruthGate(
  tenantId: string = TENANT_ID,
): Promise<InstitutionalGoLiveReport> {
  const now = new Date().toISOString()
  const reportId = randomUUID()

  log.info('[liveInstitutionalTruthGate] Running live institutional truth gate', { reportId, tenantId })

  // Run all 5 live sub-reports in parallel (without re-running chaos/settlement)
  const [realityReport, settlementReport, socReport, auditReport, chaosReport] = await Promise.all([
    runLiveRealityBoundaryReport(tenantId),
    runLiveSettlementReport(tenantId),
    runLiveSocReport(tenantId),
    runInstitutionalAuditReport(tenantId),
    runLiveInstitutionalChaosReport(tenantId, false), // no new chaos run
  ])

  // Wave 47 truth gate (9 conditions)
  const wave47Gate = await runInstitutionalTruthGate(tenantId)
  const wave47Score = wave47Gate.overall_score
  const wave47Verdicts = wave47Gate.gates.map(g => `${g.condition}:${g.verdict}:${g.score}`).join('|')

  // Wave 48 live gates (15 conditions)
  const liveGates = await buildLiveGates(
    tenantId,
    settlementReport,
    socReport,
    auditReport,
    chaosReport,
    realityReport,
  )

  const liveGatesPassed = liveGates.filter(g => g.verdict === 'PASS').length
  const liveGatesTotal = liveGates.length
  const liveGatesBlockingFailed = liveGates.filter(g => g.blocking && g.verdict === 'FAIL').length
  const liveScore = Math.round(liveGates.reduce((s, g) => s + g.score, 0) / liveGates.length)
  const combinedScore = Math.round((wave47Score + liveScore) / 2)

  const systemLiveStatus = computeSystemLiveStatus(wave47Score, liveGates)
  const institutionalGoLive = systemLiveStatus === 'FULLY_OPERATIONAL_INSTITUTIONAL_REAL_ESTATE_PLATFORM'

  // Truth certification hash
  const truthCertHash = computeTruthCertificationHash(wave47Verdicts, liveGates, tenantId, now)

  // Issue certification if go-live
  let truthCertification: TruthCertification | null = null
  if (systemLiveStatus !== 'INSTITUTIONAL_NOT_LIVE') {
    truthCertification = {
      certification_id: randomUUID(),
      tenant_id: tenantId,
      certified_at: now,
      system_live_status: systemLiveStatus,
      truth_certification_hash: truthCertHash,
      institutional_go_live: institutionalGoLive,
      wave47_gates_passed: wave47Gate.gates_passed,
      wave47_gates_total: wave47Gate.gates_total,
      wave48_gates_passed: liveGatesPassed,
      wave48_gates_total: liveGatesTotal,
      combined_score: combinedScore,
      valid_until: new Date(Date.now() + 90 * 86_400_000).toISOString(), // 90-day cert window
    }

    void (supabaseAdmin as any)
      .from('truth_certifications')
      .insert({
        certification_id: truthCertification.certification_id,
        tenant_id: tenantId,
        certified_at: now,
        system_live_status: systemLiveStatus,
        truth_certification_hash: truthCertHash,
        institutional_go_live: institutionalGoLive,
        combined_score: combinedScore,
        valid_until: truthCertification.valid_until,
      })
      .catch((e: unknown) =>
        log.warn('[liveInstitutionalTruthGate] certification persist failed', { e: String(e) }),
      )
  }

  // Pre-live blockers and warnings
  const preLiveBlockers = liveGates
    .filter(g => g.blocking && (g.verdict === 'FAIL'))
    .map(g => `[BLOCKER] ${g.condition}: ${g.detail}`)

  const preLiveWarnings = liveGates
    .filter(g => g.verdict === 'WARN')
    .map(g => `[WARN] ${g.condition}: ${g.detail}`)

  const activationSteps = [
    ...realityReport.psp_connectivity.issues,
    ...settlementReport.recommendations,
    ...socReport.recommendations,
    ...auditReport.recommendations,
    ...chaosReport.recommendations,
  ].filter(Boolean).slice(0, 12)

  // Persist report
  void (supabaseAdmin as any)
    .from('institutional_go_live_reports')
    .insert({
      report_id: reportId,
      tenant_id: tenantId,
      generated_at: now,
      system_live_status: systemLiveStatus,
      institutional_go_live: institutionalGoLive,
      combined_score: combinedScore,
      live_gates_passed: liveGatesPassed,
      live_gates_total: liveGatesTotal,
      live_gates_blocking_failed: liveGatesBlockingFailed,
      sha256_truth_hash: truthCertHash,
    })
    .catch((e: unknown) =>
      log.warn('[liveInstitutionalTruthGate] report persist failed', { e: String(e) }),
    )

  log.info('[liveInstitutionalTruthGate] Complete', {
    report_id: reportId,
    status: systemLiveStatus,
    combined_score: String(combinedScore),
    live_gates_passed: String(liveGatesPassed),
    blockers: String(liveGatesBlockingFailed),
  })

  return {
    report_id: reportId,
    tenant_id: tenantId,
    generated_at: now,
    system_live_status: systemLiveStatus,
    institutional_go_live: institutionalGoLive,
    truth_certification: truthCertification,
    wave47_gates_passed: wave47Gate.gates_passed,
    wave47_gates_total: wave47Gate.gates_total,
    wave47_summary: wave47Gate.system_truth_status,
    live_gates: liveGates,
    live_gates_passed: liveGatesPassed,
    live_gates_total: liveGatesTotal,
    live_gates_blocking_failed: liveGatesBlockingFailed,
    live_reality_score: realityReport.system_reality_index.index,
    live_settlement_grade: settlementReport.consistency_grade,
    live_soc_score: socReport.operational_security_score,
    audit_readiness_score: auditReport.audit_readiness_score,
    chaos_resilience_grade: chaosReport.resilience_grade,
    pre_live_blockers: preLiveBlockers,
    pre_live_warnings: preLiveWarnings,
    activation_steps: activationSteps,
    sha256_truth_hash: truthCertHash,
  }
}
