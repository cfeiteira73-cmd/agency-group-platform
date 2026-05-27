// Agency Group — Final Absolute Certification Gate
// lib/certification/finalAbsoluteCertificationGate.ts
// Wave 51 Phase 10 — ABSOLUTE_REALITY_CERTIFICATION_ENGINE + FINAL_TRUTH_HASH
//
// 30-condition gate combining Wave 50 (24 gates) + Wave 51 hardening (6 new gates).
// Target: SYSTEM_STATUS = "FULLY_HARDENED_INSTITUTIONAL_REAL_ESTATE_CAPITAL_OPERATING_SYSTEM"
// FINAL_INSTITUTIONAL_READINESS_REPORT.json generated when gate passes.
// Extends absoluteInstitutionalRealityGate.ts — NEVER replaces it.
// TypeScript strict — 0 errors

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { runAbsoluteInstitutionalRealityGate } from './absoluteInstitutionalRealityGate'
import { runFullSystemOperationalCommandCenter } from '@/lib/operations/fullSystemOperationalCommandCenter'
import { runCapitalExecutionHardening }         from '@/lib/capital/capitalExecutionHardening'
import { runProviderRealityHardening }           from '@/lib/production/providerRealityHardening'
import { runLiveSecurityHardening }              from '@/lib/security/liveSecurityHardening'
import { runDrChaosTruth }                       from '@/lib/resilience/drChaosTruth'
import { runMlDataTruthHardening }               from '@/lib/ml/mlDataTruthHardening'
import { runComplianceEvidenceHardening }        from '@/lib/compliance/complianceEvidenceHardening'

// ── Constants ──────────────────────────────────────────────────────────────────

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

const CERT_VALIDITY_DAYS            = 90
const TOTAL_W51_GATES               = 6
const TOTAL_W50_GATES               = 24
const TOTAL_GATES                   = TOTAL_W50_GATES + TOTAL_W51_GATES  // 30

// ── Types ──────────────────────────────────────────────────────────────────────

export type W51GateCondition =
  | 'PROVIDER_REALITY_HARDENED'
  | 'CAPITAL_EXECUTION_CERTIFIED'
  | 'SECURITY_HARDENING_CERTIFIED'
  | 'DR_CHAOS_TRUTH_PROVEN'
  | 'ML_DATA_TRUTH_CERTIFIED'
  | 'COMPLIANCE_EVIDENCE_HARDENED'

export type FinalGateVerdict = 'PASS' | 'FAIL' | 'WARN' | 'PENDING'

export type FinalSystemStatus =
  | 'FULLY_HARDENED_INSTITUTIONAL_REAL_ESTATE_CAPITAL_OPERATING_SYSTEM'
  | 'CONDITIONALLY_HARDENED'
  | 'HARDENED_WITH_GAPS'
  | 'PARTIALLY_HARDENED'
  | 'INSTITUTIONAL_BLOCKED'

export interface W51GateResult {
  condition: W51GateCondition
  verdict: FinalGateVerdict
  score: number
  evidence: string
  blocker: boolean
}

export interface FinalOperationalTruthGate {
  gate_id: string
  tenant_id: string
  w50_gates_passed: number
  w50_gates_total: number
  w51_gates_passed: number
  w51_gates_total: number
  total_gates_passed: number
  total_gates: number
  w51_gate_results: W51GateResult[]
  final_system_status: FinalSystemStatus
  go_live_authorized: boolean
  institutional_capital_authorized: boolean
  final_truth_hash: string
  generated_at: string
}

export interface SystemOperationalCertificate {
  certificate_id: string
  tenant_id: string
  system_status: FinalSystemStatus
  total_gates_passed: number
  total_gates: number
  gate_pass_pct: number
  w50_gates_passed: number
  w51_gates_passed: number
  blended_system_score: number
  issued_at: string
  valid_until: string
  auto_expires_on: 'ANY_BLOCKING_GATE_FAILURE'
  certificate_hash: string
}

export interface FinalInstitutionalReadinessReport {
  report_id: string
  tenant_id: string
  final_system_status: FinalSystemStatus
  go_live_authorized: boolean
  institutional_capital_authorized: boolean
  system_operational_certificate: SystemOperationalCertificate
  final_operational_truth_gate: FinalOperationalTruthGate
  blended_system_score: number
  w50_absolute_status: string
  w51_hardening_status: string
  command_center_status: string
  total_gates_passed: number
  total_gates: number
  gate_pass_pct: number
  blockers: string[]
  activation_steps: string[]
  final_truth_hash: string
  w50_certification_hash: string
  generated_at: string
}

// ── W51 gate evaluators ───────────────────────────────────────────────────────

async function evaluateW51Gates(
  tenantId: string,
): Promise<W51GateResult[]> {
  const [cap, prov, sec, dr, ml, comp] = await Promise.allSettled([
    runCapitalExecutionHardening(tenantId),
    runProviderRealityHardening(tenantId),
    runLiveSecurityHardening(tenantId),
    runDrChaosTruth(tenantId),
    runMlDataTruthHardening(tenantId),
    runComplianceEvidenceHardening(tenantId),
  ])

  const capVal  = cap.status  === 'fulfilled' ? cap.value  : null
  const provVal = prov.status === 'fulfilled' ? prov.value : null
  const secVal  = sec.status  === 'fulfilled' ? sec.value  : null
  const drVal   = dr.status   === 'fulfilled' ? dr.value   : null
  const mlVal   = ml.status   === 'fulfilled' ? ml.value   : null
  const compVal = comp.status === 'fulfilled' ? comp.value : null

  const gates: W51GateResult[] = [
    {
      condition: 'PROVIDER_REALITY_HARDENED',
      verdict:   (provVal?.provider_truth_index ?? 0) >= 70 ? 'PASS' : 'FAIL',
      score:     provVal?.provider_truth_index ?? 0,
      evidence:  `Provider truth index: ${provVal?.provider_truth_index ?? 0}/100`,
      blocker:   false,
    },
    {
      condition: 'CAPITAL_EXECUTION_CERTIFIED',
      verdict:   capVal?.blockers.length === 0 && (capVal?.capital_execution_score ?? 0) >= 80 ? 'PASS' : 'FAIL',
      score:     capVal?.capital_execution_score ?? 0,
      evidence:  `Capital score: ${capVal?.capital_execution_score ?? 0}/100, blockers: ${capVal?.blockers.length ?? 0}`,
      blocker:   (capVal?.blockers.length ?? 0) > 0,
    },
    {
      condition: 'SECURITY_HARDENING_CERTIFIED',
      verdict:   secVal?.blockers.length === 0 && (secVal?.security_score ?? 0) >= 70 ? 'PASS' : 'FAIL',
      score:     secVal?.security_score ?? 0,
      evidence:  `Security score: ${secVal?.security_score ?? 0}/100, OWASP pass: ${secVal?.owasp_pass_count ?? 0}/10`,
      blocker:   (secVal?.blockers.length ?? 0) > 0,
    },
    {
      condition: 'DR_CHAOS_TRUTH_PROVEN',
      verdict:   drVal?.dr_status === 'DR_CERTIFIED' || drVal?.dr_status === 'DR_OPERATIONAL' ? 'PASS' : 'WARN',
      score:     drVal?.resilience_score ?? 0,
      evidence:  `DR status: ${drVal?.dr_status ?? 'UNKNOWN'}, RTO compliance: ${drVal?.rto_compliance_pct ?? 0}%`,
      blocker:   false,
    },
    {
      condition: 'ML_DATA_TRUTH_CERTIFIED',
      verdict:   mlVal?.ml_status === 'ML_CERTIFIED' || mlVal?.ml_status === 'ML_OPERATIONAL' ? 'PASS' : 'WARN',
      score:     mlVal?.ml_truth_score ?? 0,
      evidence:  `ML status: ${mlVal?.ml_status ?? 'UNKNOWN'}, models stable: ${mlVal?.models_stable ?? 0}`,
      blocker:   false,
    },
    {
      condition: 'COMPLIANCE_EVIDENCE_HARDENED',
      verdict:   compVal?.blockers.length === 0 && (compVal?.compliance_score ?? 0) >= 70 ? 'PASS' : 'FAIL',
      score:     compVal?.compliance_score ?? 0,
      evidence:  `Compliance score: ${compVal?.compliance_score ?? 0}/100, evidence items: ${compVal?.total_evidence_items ?? 0}`,
      blocker:   (compVal?.blockers.length ?? 0) > 0,
    },
  ]

  return gates
}

function computeFinalSystemStatus(
  w50GatesPassed: number,
  w51GatesPassed: number,
  blockers: number,
): FinalSystemStatus {
  const totalPassed = w50GatesPassed + w51GatesPassed
  if (blockers > 0)                                    return 'INSTITUTIONAL_BLOCKED'
  if (totalPassed === TOTAL_GATES)                     return 'FULLY_HARDENED_INSTITUTIONAL_REAL_ESTATE_CAPITAL_OPERATING_SYSTEM'
  if (totalPassed >= TOTAL_GATES - 2)                  return 'CONDITIONALLY_HARDENED'
  if (totalPassed >= TOTAL_GATES - 5)                  return 'HARDENED_WITH_GAPS'
  return 'PARTIALLY_HARDENED'
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runFinalAbsoluteCertificationGate(
  tenantId?: string,
): Promise<FinalInstitutionalReadinessReport> {
  const tid   = tenantId ?? TENANT_ID
  const start = Date.now()

  log.info('[finalAbsoluteCertificationGate] starting', { tenantId: tid })

  // Run Wave 50 gate + command center + W51 gates in parallel
  const [w50Result, commandCenter, w51Gates] = await Promise.all([
    runAbsoluteInstitutionalRealityGate(tid).catch((e: unknown) => {
      log.warn('[finalAbsoluteCertificationGate] w50Gate failed', { e: String(e) })
      return null
    }),
    runFullSystemOperationalCommandCenter(tid).catch((e: unknown) => {
      log.warn('[finalAbsoluteCertificationGate] commandCenter failed', { e: String(e) })
      return null
    }),
    evaluateW51Gates(tid),
  ])

  const w50GatesPassed   = w50Result?.gates_passed ?? 0
  const w50CertHash      = w50Result?.absolute_reality_hash ?? ''
  const w50AbsoluteStatus = w50Result?.absolute_status ?? 'PRE_OPERATIONAL'
  const commandStatus    = commandCenter?.command_status ?? 'SYSTEM_OFFLINE'
  const blendedScore     = commandCenter?.blended_score ?? 0

  const w51Passed  = w51Gates.filter(g => g.verdict === 'PASS').length
  const w51Blockers = w51Gates.filter(g => g.blocker && g.verdict === 'FAIL')

  const totalPassed = w50GatesPassed + w51Passed
  const totalBlockers = w51Blockers.length + (w50Result?.gates_blocking_failed ?? 0)

  const finalStatus = computeFinalSystemStatus(w50GatesPassed, w51Passed, totalBlockers)
  const goLiveAuth  = finalStatus === 'FULLY_HARDENED_INSTITUTIONAL_REAL_ESTATE_CAPITAL_OPERATING_SYSTEM' ||
                      finalStatus === 'CONDITIONALLY_HARDENED'
  const capitalAuth = finalStatus === 'FULLY_HARDENED_INSTITUTIONAL_REAL_ESTATE_CAPITAL_OPERATING_SYSTEM'

  const blockers: string[] = [
    ...w51Blockers.map(g => `W51 blocker: ${g.condition}`),
    ...(w50Result?.blockers ?? []),
  ]

  const activationSteps: string[] = []
  if (!goLiveAuth) {
    if (totalBlockers > 0) activationSteps.push(`Resolve ${totalBlockers} blocking gate(s)`)
    if (w51Passed < TOTAL_W51_GATES) activationSteps.push(`Pass remaining ${TOTAL_W51_GATES - w51Passed} W51 gate(s)`)
    if (w50GatesPassed < TOTAL_W50_GATES) activationSteps.push(`Pass remaining ${TOTAL_W50_GATES - w50GatesPassed} W50 gate(s)`)
  }

  // Build truth gate
  const finalTruthHash = createHash('sha256')
    .update(`FINAL_TRUTH|${tid}|${new Date().toISOString().split('T')[0]}|${finalStatus}|${w51Gates.map(g => g.verdict).join(',')}|${w50CertHash}|${blendedScore}`)
    .digest('hex')

  const truthGate: FinalOperationalTruthGate = {
    gate_id:                          randomUUID(),
    tenant_id:                        tid,
    w50_gates_passed:                 w50GatesPassed,
    w50_gates_total:                  TOTAL_W50_GATES,
    w51_gates_passed:                 w51Passed,
    w51_gates_total:                  TOTAL_W51_GATES,
    total_gates_passed:               totalPassed,
    total_gates:                      TOTAL_GATES,
    w51_gate_results:                 w51Gates,
    final_system_status:              finalStatus,
    go_live_authorized:               goLiveAuth,
    institutional_capital_authorized: capitalAuth,
    final_truth_hash:                 finalTruthHash,
    generated_at:                     new Date().toISOString(),
  }

  // Certificate
  const issuedAt     = new Date()
  const validUntil   = new Date(issuedAt.getTime() + CERT_VALIDITY_DAYS * 24 * 3600 * 1000)
  const gatePct      = Math.round((totalPassed / TOTAL_GATES) * 100)
  const certHash     = createHash('sha256')
    .update(`SYSTEM_CERT|${tid}|${finalStatus}|${totalPassed}|${blendedScore}|${finalTruthHash}|${issuedAt.toISOString()}`)
    .digest('hex')

  const certificate: SystemOperationalCertificate = {
    certificate_id:                   randomUUID(),
    tenant_id:                        tid,
    system_status:                    finalStatus,
    total_gates_passed:               totalPassed,
    total_gates:                      TOTAL_GATES,
    gate_pass_pct:                    gatePct,
    w50_gates_passed:                 w50GatesPassed,
    w51_gates_passed:                 w51Passed,
    blended_system_score:             blendedScore,
    issued_at:                        issuedAt.toISOString(),
    valid_until:                      validUntil.toISOString(),
    auto_expires_on:                  'ANY_BLOCKING_GATE_FAILURE',
    certificate_hash:                 certHash,
  }

  const report: FinalInstitutionalReadinessReport = {
    report_id:                       randomUUID(),
    tenant_id:                       tid,
    final_system_status:             finalStatus,
    go_live_authorized:              goLiveAuth,
    institutional_capital_authorized: capitalAuth,
    system_operational_certificate:  certificate,
    final_operational_truth_gate:    truthGate,
    blended_system_score:            blendedScore,
    w50_absolute_status:             w50AbsoluteStatus,
    w51_hardening_status:            commandCenter?.system_hardening_status ?? 'NOT_HARDENED',
    command_center_status:           commandStatus,
    total_gates_passed:              totalPassed,
    total_gates:                     TOTAL_GATES,
    gate_pass_pct:                   gatePct,
    blockers,
    activation_steps:                activationSteps,
    final_truth_hash:                finalTruthHash,
    w50_certification_hash:          w50CertHash,
    generated_at:                    new Date().toISOString(),
  }

  const { error } = await (supabaseAdmin as unknown as { from: (t: string) => { insert: (v: unknown) => { error: unknown } } })
    .from('final_absolute_certifications')
    .insert({
      report_id:             report.report_id,
      tenant_id:             tid,
      final_system_status:   report.final_system_status,
      total_gates_passed:    report.total_gates_passed,
      total_gates:           report.total_gates,
      gate_pass_pct:         report.gate_pass_pct,
      blended_score:         report.blended_system_score,
      go_live_authorized:    report.go_live_authorized,
      blocker_count:         blockers.length,
      final_truth_hash:      report.final_truth_hash,
      certificate_hash:      certHash,
      report_json:           JSON.stringify(report),
      generated_at:          report.generated_at,
    })
  if (error) log.warn('[finalAbsoluteCertificationGate] persist failed', { error })

  log.info('[finalAbsoluteCertificationGate] complete', {
    status:     finalStatus,
    gates:      `${totalPassed}/${TOTAL_GATES}`,
    blended:    blendedScore,
    durationMs: Date.now() - start,
  })

  return report
}
