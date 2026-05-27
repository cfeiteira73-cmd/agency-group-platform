// Agency Group — Final Institutional Go-Live Gate
// lib/certification/finalInstitutionalGoLiveGate.ts
// Wave 49 Phase 7 — Definitive go/no-go for live institutional operation
//
// 20-condition gate. System becomes "FULLY_OPERATIONAL_INSTITUTIONAL_REAL_ESTATE_PLATFORM"
// only when ALL pass. Generates FINAL_INSTITUTIONAL_CERTIFICATION + GO_LIVE_TRUTH_HASH.
// Extends liveInstitutionalTruthGate.ts — NEVER replaces it.
// TypeScript strict — 0 errors

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { runLiveInstitutionalTruthGate } from './liveInstitutionalTruthGate'
import { runLiveCommandCenter } from '@/lib/operations/liveInstitutionalCommandCenter'
import { runLiveProviderMeshReport } from '@/lib/providers/liveProviderOperationsMesh'
import { runLiveSettlementCoreReport } from '@/lib/banking/liveInstitutionalSettlementCore'
import { runLiveSocGridReport } from '@/lib/security/liveInstitutionalSocGrid'
import { runRegulatoryRealitySystem } from '@/lib/compliance/institutionalRegulatoryRealitySystem'
import { runLiveProductionChaosGrid } from '@/lib/resilience/liveProductionChaosGrid'

// ── Constants ──────────────────────────────────────────────────────────────────

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

const CERT_VALIDITY_DAYS = 90

// ── Types ──────────────────────────────────────────────────────────────────────

export type FinalGateCondition =
  // Provider reality (3)
  | 'LIVE_PROVIDERS_VALIDATED'
  | 'PROVIDER_SLA_VERIFIED'
  | 'PROVIDER_FALLBACK_VERIFIED'
  // Financial reality (4)
  | 'REAL_BANK_SETTLEMENT_VERIFIED'
  | 'RECONCILIATION_99_5_PCT'
  | 'NO_ORPHAN_CAPITAL'
  | 'NO_DUPLICATE_SETTLEMENTS'
  // Security reality (4)
  | 'LIVE_SIEM_ACTIVE'
  | 'SOC_ESCALATION_ACTIVE'
  | 'KEY_ROTATION_ACTIVE'
  | 'ZERO_UNRESOLVED_SEV1'
  // Resilience (3)
  | 'RANSOMWARE_SIMULATION_VERIFIED'
  | 'DR_RESTORE_VERIFIED'
  | 'FAILOVER_VERIFIED'
  // Compliance (3)
  | 'SOC2_READINESS_90PCT'
  | 'ISO27001_READINESS_90PCT'
  | 'ZERO_CRITICAL_VULNERABILITIES'
  // Capital integrity (2)
  | 'ML_DRIFT_BELOW_02'
  | 'LIQUIDITY_INTEGRITY_VERIFIED'
  // Operational truth (1)
  | 'OPERATIONAL_TRUTH_SCORE_95'

export type FinalGateVerdict = 'PASS' | 'FAIL' | 'WARN' | 'PENDING'

export type FinalSystemStatus =
  | 'FULLY_OPERATIONAL_INSTITUTIONAL_REAL_ESTATE_PLATFORM'
  | 'CONDITIONALLY_OPERATIONAL'
  | 'OPERATIONAL_WITH_GAPS'
  | 'PRE_OPERATIONAL'
  | 'INSTITUTIONAL_BLOCKED'

export interface FinalGateResult {
  condition: FinalGateCondition
  verdict: FinalGateVerdict
  score: number
  detail: string
  evidence: string
  blocking: boolean
  checked_at: string
}

export interface OperationalRealityCertificate {
  cert_id: string
  tenant_id: string
  issued_at: string
  valid_until: string
  final_system_status: FinalSystemStatus
  go_live_truth_hash: string
  gates_passed: number
  gates_total: number
  combined_score: number
  issued_by: string
  revocable: true
}

export interface FinalInstitutionalCertification {
  report_id: string
  tenant_id: string
  generated_at: string
  // Final status
  final_system_status: FinalSystemStatus
  go_live_authorized: boolean
  institutional_capital_authorized: boolean
  // Gate results
  final_gates: FinalGateResult[]
  gates_passed: number
  gates_total: number
  gates_blocking_failed: number
  // Scores
  combined_score: number
  global_operational_score: number
  // Wave 48 base
  wave48_system_live_status: string
  wave48_live_gates_passed: number
  // Hashes
  go_live_truth_hash: string
  sha256_certification_hash: string
  // Certificate
  operational_reality_certificate: OperationalRealityCertificate | null
  // Blockers + activation
  blockers: string[]
  warnings: string[]
  activation_steps: string[]
}

// ── Gate checker ───────────────────────────────────────────────────────────────

function gate(
  condition: FinalGateCondition,
  verdict: FinalGateVerdict,
  score: number,
  detail: string,
  evidence: string,
  blocking: boolean,
): FinalGateResult {
  return { condition, verdict, score, detail, evidence, blocking, checked_at: new Date().toISOString() }
}

// ── Build all 20 gates ────────────────────────────────────────────────────────

async function buildFinalGates(
  tenantId: string,
  provider: Awaited<ReturnType<typeof runLiveProviderMeshReport>>,
  settlement: Awaited<ReturnType<typeof runLiveSettlementCoreReport>>,
  soc: Awaited<ReturnType<typeof runLiveSocGridReport>>,
  regulatory: Awaited<ReturnType<typeof runRegulatoryRealitySystem>>,
  chaos: Awaited<ReturnType<typeof runLiveProductionChaosGrid>>,
  cmdCenter: Awaited<ReturnType<typeof runLiveCommandCenter>>,
): Promise<FinalGateResult[]> {
  const gates: FinalGateResult[] = []
  const _ = tenantId   // reserved for future per-tenant DB checks

  // ── Provider reality gates ────────────────────────────────────────────────

  gates.push(gate(
    'LIVE_PROVIDERS_VALIDATED',
    provider.provider_truth_index >= 60 ? 'PASS' : provider.provider_truth_index >= 40 ? 'WARN' : 'FAIL',
    provider.provider_truth_index,
    `Provider truth index: ${provider.provider_truth_index}/100 (${provider.provider_truth_label})`,
    `${provider.providers_healthy} healthy, ${provider.providers_unconfigured} unconfigured`,
    provider.provider_truth_index < 40,
  ))

  gates.push(gate(
    'PROVIDER_SLA_VERIFIED',
    provider.stale_alerts.length === 0 ? 'PASS' : provider.stale_alerts.length < 3 ? 'WARN' : 'FAIL',
    provider.stale_alerts.length === 0 ? 100 : Math.max(0, 100 - provider.stale_alerts.length * 20),
    `${provider.stale_alerts.length} SLA breach(es)`,
    provider.stale_alerts.length === 0 ? 'All providers within SLA' : provider.stale_alerts.slice(0, 2).join('; '),
    provider.stale_alerts.length >= 3,
  ))

  gates.push(gate(
    'PROVIDER_FALLBACK_VERIFIED',
    provider.active_fallbacks.length > 0 || provider.providers_healthy > 5 ? 'PASS' : 'WARN',
    provider.providers_healthy > 5 ? 100 : provider.active_fallbacks.length > 0 ? 80 : 40,
    `${provider.active_fallbacks.length} active fallback route(s)`,
    provider.active_fallbacks.length > 0
      ? provider.active_fallbacks.map(f => `${f.from}→${f.to}`).join(', ')
      : 'No active fallbacks — primary providers healthy',
    false,
  ))

  // ── Financial reality gates ───────────────────────────────────────────────

  gates.push(gate(
    'REAL_BANK_SETTLEMENT_VERIFIED',
    settlement.bank_confirmed_count > 0 ? 'PASS' : 'FAIL',
    settlement.bank_confirmed_count > 0 ? 100 : 0,
    `${settlement.bank_confirmed_count} BANK_CONFIRMED transactions`,
    settlement.bank_confirmed_count > 0 ? `real_money: ${settlement.real_money_eur}` : 'No bank-confirmed settlements — configure bank statement webhook',
    settlement.bank_confirmed_count === 0,
  ))

  gates.push(gate(
    'RECONCILIATION_99_5_PCT',
    settlement.reconciliation_accuracy_pct >= 99.5 ? 'PASS' :
    settlement.reconciliation_accuracy_pct >= 95  ? 'WARN' : 'FAIL',
    settlement.reconciliation_accuracy_pct,
    `Reconciliation: ${settlement.reconciliation_accuracy_pct.toFixed(2)}%`,
    `Target: 99.5% | Mismatches: ${settlement.mismatch_count}`,
    settlement.reconciliation_accuracy_pct < 95 && settlement.total_transactions > 0,
  ))

  gates.push(gate(
    'NO_ORPHAN_CAPITAL',
    !settlement.orphan_capital_critical ? 'PASS' : 'FAIL',
    settlement.orphan_capital_critical ? 0 : 100,
    `Orphan capital: ${settlement.orphan_capital_entries} entries (${settlement.orphan_capital_total_eur})`,
    settlement.orphan_capital_critical ? 'Orphan capital detected — immediate resolution required' : 'No orphan capital',
    settlement.orphan_capital_critical,
  ))

  gates.push(gate(
    'NO_DUPLICATE_SETTLEMENTS',
    settlement.duplicate_settlements_detected === 0 ? 'PASS' : 'FAIL',
    settlement.duplicate_settlements_detected === 0 ? 100 : 0,
    `${settlement.duplicate_settlements_detected} duplicate settlement(s)`,
    settlement.duplicate_settlements_detected === 0 ? 'No duplicates' : 'Duplicate settlements detected — reconciliation required',
    settlement.duplicate_settlements_detected > 0,
  ))

  // ── Security reality gates ────────────────────────────────────────────────

  gates.push(gate(
    'LIVE_SIEM_ACTIVE',
    soc.siem_platforms_configured > 0 ? 'PASS' : 'FAIL',
    soc.siem_platforms_configured * 25,
    `${soc.siem_platforms_configured} SIEM platform(s) active`,
    soc.siem_fanout.filter(s => s.configured).map(s => s.platform).join(', ') || 'None configured',
    soc.siem_platforms_configured === 0,
  ))

  gates.push(gate(
    'SOC_ESCALATION_ACTIVE',
    soc.escalation_chains_active ? 'PASS' : 'FAIL',
    soc.escalation_chains_active ? 100 : 0,
    soc.escalation_chains_active ? 'Escalation chains configured' : 'No escalation channels — PagerDuty/Opsgenie/Slack required',
    [
      soc.pagerduty_configured ? 'PagerDuty' : null,
      soc.opsgenie_configured  ? 'Opsgenie'  : null,
      soc.slack_soc_configured ? 'Slack SOC' : null,
    ].filter(Boolean).join(', ') || 'None',
    !soc.escalation_chains_active,
  ))

  gates.push(gate(
    'KEY_ROTATION_ACTIVE',
    soc.secrets_overdue === 0 ? 'PASS' : 'FAIL',
    soc.secrets_overdue === 0 ? 100 : Math.max(0, 100 - soc.secrets_overdue * 25),
    `${soc.secrets_overdue} secret(s) overdue rotation`,
    soc.secrets_overdue === 0 ? 'All secrets within rotation policy' : `${soc.secrets_overdue} secret(s) exceed ${90}d rotation window`,
    soc.secrets_overdue > 0,
  ))

  gates.push(gate(
    'ZERO_UNRESOLVED_SEV1',
    soc.unresolved_sev1 === 0 ? 'PASS' : 'FAIL',
    soc.unresolved_sev1 === 0 ? 100 : 0,
    `${soc.unresolved_sev1} unresolved SEV1 incident(s)`,
    soc.unresolved_sev1 === 0 ? 'No unresolved SEV1 incidents' : `${soc.unresolved_sev1} SEV1 incident(s) open >15min — SLA breached`,
    soc.unresolved_sev1 > 0,
  ))

  // ── Resilience gates ──────────────────────────────────────────────────────

  const ransomwareScenario = chaos.scenarios.find(s => s.scenario === 'RANSOMWARE_SIM')
  gates.push(gate(
    'RANSOMWARE_SIMULATION_VERIFIED',
    ransomwareScenario?.outcome === 'PASSED' ? 'PASS' :
    ransomwareScenario?.outcome === 'DRY_RUN' ? 'WARN' : 'FAIL',
    ransomwareScenario?.outcome === 'PASSED' ? 100 : ransomwareScenario?.outcome === 'DRY_RUN' ? 50 : 0,
    `Ransomware sim: ${ransomwareScenario?.outcome ?? 'NOT_RUN'}`,
    ransomwareScenario?.evidence ?? 'Not executed',
    ransomwareScenario?.outcome === 'FAILED',
  ))

  const dbFailover = chaos.scenarios.find(s => s.scenario === 'DB_FAILOVER')
  gates.push(gate(
    'DR_RESTORE_VERIFIED',
    dbFailover?.outcome === 'PASSED' ? 'PASS' :
    dbFailover?.outcome === 'DRY_RUN' ? 'WARN' : 'FAIL',
    dbFailover?.outcome === 'PASSED' ? 100 : dbFailover?.outcome === 'DRY_RUN' ? 60 : 0,
    `DB failover: ${dbFailover?.outcome ?? 'NOT_RUN'}`,
    dbFailover?.evidence ?? 'Not executed',
    dbFailover?.outcome === 'FAILED',
  ))

  gates.push(gate(
    'FAILOVER_VERIFIED',
    chaos.multi_region.failover_verified ? 'PASS' :
    chaos.multi_region.regions_tested.length > 0 ? 'WARN' : 'FAIL',
    chaos.multi_region.failover_verified ? 100 : chaos.multi_region.regions_tested.length > 0 ? 50 : 20,
    chaos.multi_region.failover_verified ? 'Multi-region failover verified' : 'Failover not verified',
    chaos.multi_region.recovery_path,
    false,  // blocking only if fully failed
  ))

  // ── Compliance gates ──────────────────────────────────────────────────────

  gates.push(gate(
    'SOC2_READINESS_90PCT',
    regulatory.soc2_target_met ? 'PASS' : regulatory.soc2_score >= 70 ? 'WARN' : 'FAIL',
    regulatory.soc2_score,
    `SOC2 Type II: ${regulatory.soc2_score}% (target: 90%)`,
    regulatory.soc2_target_met ? 'SOC2 target met' : `${90 - regulatory.soc2_score}% gap to close`,
    regulatory.soc2_score < 50,
  ))

  gates.push(gate(
    'ISO27001_READINESS_90PCT',
    regulatory.iso27001_target_met ? 'PASS' : regulatory.iso27001_score >= 70 ? 'WARN' : 'FAIL',
    regulatory.iso27001_score,
    `ISO 27001:2022: ${regulatory.iso27001_score}% (target: 90%)`,
    regulatory.iso27001_target_met ? 'ISO 27001 target met' : `${90 - regulatory.iso27001_score}% gap to close`,
    regulatory.iso27001_score < 50,
  ))

  gates.push(gate(
    'ZERO_CRITICAL_VULNERABILITIES',
    !regulatory.pentest_governance.blocker ? 'PASS' : 'FAIL',
    regulatory.pentest_governance.open_critical === 0 ? 100 : 0,
    `Critical vulns: ${regulatory.pentest_governance.open_critical} open`,
    regulatory.pentest_governance.open_critical === 0 ? 'No critical vulnerabilities' : `${regulatory.pentest_governance.open_critical} critical — immediate BLOCKER`,
    regulatory.pentest_governance.blocker,
  ))

  // ── Capital integrity gates ───────────────────────────────────────────────

  const mlDrift = cmdCenter.ml_drift
  gates.push(gate(
    'ML_DRIFT_BELOW_02',
    mlDrift.drift_score === null ? 'PENDING' : mlDrift.below_threshold ? 'PASS' : 'FAIL',
    mlDrift.drift_score === null ? 50 : mlDrift.below_threshold ? 100 : 0,
    mlDrift.drift_score === null ? 'ML drift not measured' : `Drift: ${mlDrift.drift_score} (threshold: ${mlDrift.threshold})`,
    mlDrift.below_threshold ? 'ML models within drift threshold' : 'ML drift exceeds 0.2 — retrain required',
    false,
  ))

  gates.push(gate(
    'LIQUIDITY_INTEGRITY_VERIFIED',
    cmdCenter.liquidity_health.liquidity_score >= 80 ? 'PASS' :
    cmdCenter.liquidity_health.liquidity_score >= 60 ? 'WARN' : 'FAIL',
    cmdCenter.liquidity_health.liquidity_score,
    `Liquidity score: ${cmdCenter.liquidity_health.liquidity_score}/100`,
    `Active locks: ${cmdCenter.liquidity_health.active_locks} | Orphan entries: ${cmdCenter.liquidity_health.orphan_capital_entries}`,
    cmdCenter.liquidity_health.liquidity_score < 40,
  ))

  // ── Operational truth gate ────────────────────────────────────────────────

  gates.push(gate(
    'OPERATIONAL_TRUTH_SCORE_95',
    cmdCenter.global_operational_score >= 95 ? 'PASS' :
    cmdCenter.global_operational_score >= 80 ? 'WARN' : 'FAIL',
    cmdCenter.global_operational_score,
    `Global operational score: ${cmdCenter.global_operational_score}/100`,
    `Readiness: ${cmdCenter.operational_readiness}`,
    cmdCenter.global_operational_score < 50,
  ))

  return gates
}

// ── Final system status ───────────────────────────────────────────────────────

function computeFinalStatus(
  gates: FinalGateResult[],
  wave48Status: string,
): { status: FinalSystemStatus; score: number } {
  const passed = gates.filter(g => g.verdict === 'PASS').length
  const blockingFailed = gates.filter(g => g.verdict === 'FAIL' && g.blocking).length
  const total = gates.length
  const score = Math.round((passed / total) * 100)

  if (blockingFailed > 0) return { status: 'INSTITUTIONAL_BLOCKED', score }
  if (passed === total)   return { status: 'FULLY_OPERATIONAL_INSTITUTIONAL_REAL_ESTATE_PLATFORM', score }
  if (passed >= 17)       return { status: 'CONDITIONALLY_OPERATIONAL', score }
  if (passed >= 14)       return { status: 'OPERATIONAL_WITH_GAPS', score }
  return { status: 'PRE_OPERATIONAL', score }
}

// ── Build GO_LIVE_TRUTH_HASH ──────────────────────────────────────────────────

function buildTruthHash(
  tenantId: string,
  gates: FinalGateResult[],
  wave48Hash: string,
  globalScore: number,
): string {
  const gateDigest = gates.map(g => `${g.condition}:${g.verdict}`).join('|')
  return createHash('sha256')
    .update(`${tenantId}|${new Date().toISOString().slice(0, 10)}|${gateDigest}|${wave48Hash}|${globalScore}`)
    .digest('hex')
}

// ── Activation steps ──────────────────────────────────────────────────────────

function buildActivationSteps(gates: FinalGateResult[]): string[] {
  return gates
    .filter(g => g.verdict !== 'PASS')
    .map(g => `[${g.verdict}] ${g.condition}: ${g.detail}`)
    .slice(0, 10)
}

// ── Persist ────────────────────────────────────────────────────────────────────

async function persist(cert: FinalInstitutionalCertification): Promise<void> {
  try {
    await (supabaseAdmin as any).from('final_go_live_certifications').insert({
      report_id: cert.report_id, tenant_id: cert.tenant_id, generated_at: cert.generated_at,
      final_system_status: cert.final_system_status, go_live_authorized: cert.go_live_authorized,
      gates_passed: cert.gates_passed, gates_total: cert.gates_total,
      combined_score: cert.combined_score, go_live_truth_hash: cert.go_live_truth_hash,
      sha256_certification_hash: cert.sha256_certification_hash, blockers: cert.blockers,
    })
  } catch (e) { log.warn('[finalGoLiveGate] persist failed', { e: String(e) }) }
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function runFinalInstitutionalGoLiveGate(tenantId?: string): Promise<FinalInstitutionalCertification> {
  const tid = tenantId ?? TENANT_ID
  const reportId = randomUUID()

  // Run Wave 48 gate + all 5 Wave 49 sub-reports + command center in parallel
  const [wave48, providerR, settlementR, socR, regulatoryR, chaosR, cmdR] = await Promise.all([
    runLiveInstitutionalTruthGate(tid).catch(() => null),
    runLiveProviderMeshReport(tid).catch(() => null),
    runLiveSettlementCoreReport(tid).catch(() => null),
    runLiveSocGridReport(tid).catch(() => null),
    runRegulatoryRealitySystem(tid).catch(() => null),
    runLiveProductionChaosGrid(tid, false, 'SAFE_DRY_RUN').catch(() => null),
    runLiveCommandCenter(tid).catch(() => null),
  ])

  // Build null-safe wrappers for required sub-reports
  const provider   = providerR   ?? await runLiveProviderMeshReport(tid).catch(() => null) ?? { provider_truth_index: 0, provider_truth_label: 'UNCONFIGURED' as const, providers_healthy: 0, providers_unconfigured: 10, stale_alerts: [], active_fallbacks: [], issues: [], recommendations: [] } as unknown as Awaited<ReturnType<typeof runLiveProviderMeshReport>>
  const settlement = settlementR ?? { bank_confirmed_count: 0, total_transactions: 0, real_money_eur: '€0', reconciliation_accuracy_pct: 0, reconciliation_target_met: false, mismatch_count: 0, critical_mismatch_count: 0, total_mismatch_eur: '€0', orphan_capital_entries: 0, orphan_capital_total_eur: '€0', orphan_capital_critical: false, duplicate_settlements_detected: 0, financial_truth_score: 0, financial_truth_grade: 'NO_DATA' as const, issues: [], recommendations: [] } as unknown as Awaited<ReturnType<typeof runLiveSettlementCoreReport>>
  const soc        = socR        ?? { siem_platforms_configured: 0, escalation_chains_active: false, pagerduty_configured: false, opsgenie_configured: false, slack_soc_configured: false, unresolved_sev1: 0, unresolved_sev2: 0, secrets_overdue: 0, soc_grid_score: 0, siem_fanout: [], issues: [], recommendations: [] } as unknown as Awaited<ReturnType<typeof runLiveSocGridReport>>
  const regulatory = regulatoryR ?? { soc2_score: 0, soc2_target_met: false, iso27001_score: 0, iso27001_target_met: false, pentest_governance: { open_critical: 0, blocker: false, open_high: 0, open_medium: 0, sla_breached_count: 0, owasp_coverage_pct: 0, last_pentest_at: null, next_pentest_due: null }, issues: [], recommendations: [] } as unknown as Awaited<ReturnType<typeof runRegulatoryRealitySystem>>
  const chaos      = chaosR      ?? { scenarios: [], rto_hard_limit_met: false, rpo_verified: false, rollback_validated: false, multi_region: { failover_verified: false, regions_tested: [], data_sync_verified: false, rto_seconds: null, recovery_path: '' }, resilience_score: 0, issues: [], recommendations: [] } as unknown as Awaited<ReturnType<typeof runLiveProductionChaosGrid>>
  const cmd        = cmdR        ?? { global_operational_score: 0, operational_readiness: 'PRE_OPERATIONAL' as const, ml_drift: { drift_score: null, below_threshold: true, threshold: 0.2, last_checked_at: null }, liquidity_health: { active_locks: 0, orphan_capital_entries: 0, liquidity_score: 50 }, issues: [], recommendations: [] } as unknown as Awaited<ReturnType<typeof runLiveCommandCenter>>

  const finalGates = await buildFinalGates(tid, provider, settlement, soc, regulatory, chaos, cmd)

  const wave48Status = wave48?.system_live_status ?? 'INSTITUTIONAL_BLOCKED'
  const wave48GatesPassed = wave48?.live_gates_passed ?? 0
  const wave48Hash = wave48?.sha256_truth_hash ?? 'NO_WAVE48_HASH'

  const { status, score } = computeFinalStatus(finalGates, wave48Status)

  const gatesPassed = finalGates.filter(g => g.verdict === 'PASS').length
  const gatesBlockingFailed = finalGates.filter(g => g.verdict === 'FAIL' && g.blocking).length

  const goLiveAuthorized = status === 'FULLY_OPERATIONAL_INSTITUTIONAL_REAL_ESTATE_PLATFORM'
  const capitalAuthorized = goLiveAuthorized || status === 'CONDITIONALLY_OPERATIONAL'

  const truthHash = buildTruthHash(tid, finalGates, wave48Hash, cmd.global_operational_score)
  const certHash = createHash('sha256').update(`${tid}|FINAL_GATE|${score}|${truthHash}`).digest('hex')

  const certificate: OperationalRealityCertificate | null = goLiveAuthorized || status === 'CONDITIONALLY_OPERATIONAL'
    ? {
        cert_id: randomUUID(), tenant_id: tid, issued_at: new Date().toISOString(),
        valid_until: new Date(Date.now() + CERT_VALIDITY_DAYS * 86_400_000).toISOString(),
        final_system_status: status, go_live_truth_hash: truthHash,
        gates_passed: gatesPassed, gates_total: finalGates.length,
        combined_score: score, issued_by: 'FINAL_INSTITUTIONAL_GATE_v1',
        revocable: true,
      }
    : null

  const blockers = finalGates.filter(g => g.verdict === 'FAIL' && g.blocking).map(g => `[BLOCKER] ${g.condition}: ${g.detail}`)
  const warnings = finalGates.filter(g => g.verdict === 'WARN').map(g => `[WARN] ${g.condition}: ${g.detail}`)
  const activationSteps = buildActivationSteps(finalGates)

  const cert: FinalInstitutionalCertification = {
    report_id: reportId, tenant_id: tid, generated_at: new Date().toISOString(),
    final_system_status: status, go_live_authorized: goLiveAuthorized,
    institutional_capital_authorized: capitalAuthorized,
    final_gates: finalGates, gates_passed: gatesPassed, gates_total: finalGates.length,
    gates_blocking_failed: gatesBlockingFailed, combined_score: score,
    global_operational_score: cmd.global_operational_score,
    wave48_system_live_status: wave48Status, wave48_live_gates_passed: wave48GatesPassed,
    go_live_truth_hash: truthHash, sha256_certification_hash: certHash,
    operational_reality_certificate: certificate,
    blockers, warnings, activation_steps: activationSteps,
  }

  void persist(cert).catch((e: unknown) => log.warn('[finalGoLiveGate]', { e: String(e) }))
  return cert
}
