// Agency Group — Full System Operational Command Center
// lib/operations/fullSystemOperationalCommandCenter.ts
// Wave 51 Phase 9 — Unified 11-domain institutional command layer
//
// Aggregates all Wave 51 domain reports + Wave 50 reality center.
// 11 domain scores: production, financial, security, compliance, resilience,
// ml, capital, dashboard, audit, operations_w50, certification_w50.
// Extends liveInstitutionalRealityCenter.ts — NEVER replaces it.
// TypeScript strict — 0 errors

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { runLiveInstitutionalRealityCenter } from './liveInstitutionalRealityCenter'
import { runFullSystemRealityAudit }         from '@/lib/audit/fullSystemRealityAudit'
import { runAbsoluteDashboardHardening }     from '@/lib/dashboard/absoluteDashboardHardening'
import { runCapitalExecutionHardening }      from '@/lib/capital/capitalExecutionHardening'
import { runProviderRealityHardening }       from '@/lib/production/providerRealityHardening'
import { runLiveSecurityHardening }          from '@/lib/security/liveSecurityHardening'
import { runDrChaosTruth }                   from '@/lib/resilience/drChaosTruth'
import { runMlDataTruthHardening }           from '@/lib/ml/mlDataTruthHardening'
import { runComplianceEvidenceHardening }    from '@/lib/compliance/complianceEvidenceHardening'

// ── Constants ──────────────────────────────────────────────────────────────────

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

const COMMAND_CENTER_HEALTHY_SCORE  = 80
const COMMAND_CENTER_DEGRADED_SCORE = 60

// ── Types ──────────────────────────────────────────────────────────────────────

export type CommandCenterStatus =
  | 'FULLY_OPERATIONAL'
  | 'OPERATIONALLY_HEALTHY'
  | 'OPERATIONALLY_DEGRADED'
  | 'OPERATIONALLY_CRITICAL'
  | 'SYSTEM_OFFLINE'

export type DomainName =
  | 'production'
  | 'financial'
  | 'security'
  | 'compliance'
  | 'resilience'
  | 'ml'
  | 'capital'
  | 'dashboard'
  | 'audit'
  | 'operations_w50'
  | 'certification_w50'

export interface DomainHealth {
  domain: DomainName
  score: number
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'OFFLINE' | 'UNCONFIGURED'
  blockers: string[]
  warnings: string[]
  last_evaluated: string
}

export interface SystemTrend {
  domain: DomainName
  trend: 'IMPROVING' | 'STABLE' | 'DEGRADING'
  delta_score: number
  trend_window_hours: number
}

export interface InstitutionalRiskSummary {
  total_blockers: number
  total_warnings: number
  highest_risk_domain: DomainName | null
  risk_level: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  immediate_actions: string[]
}

export interface FullSystemCommandReport {
  command_id: string
  tenant_id: string
  command_status: CommandCenterStatus
  system_health_score: number
  w51_score: number
  w50_score: number
  blended_score: number
  domain_health: Record<DomainName, DomainHealth>
  system_trends: SystemTrend[]
  risk_summary: InstitutionalRiskSummary
  system_hardening_status: 'FULLY_HARDENED_INSTITUTIONAL_REAL_ESTATE_CAPITAL_OPERATING_SYSTEM' | 'PARTIALLY_HARDENED' | 'NOT_HARDENED'
  providers_operational: boolean
  capital_integrity_proven: boolean
  security_certified: boolean
  resilience_certified: boolean
  ml_stable: boolean
  compliance_evidence_ready: boolean
  command_hash: string
  generated_at: string
}

// ── Domain health evaluators ──────────────────────────────────────────────────

function makeDomainHealth(
  domain: DomainName,
  score: number,
  blockers: string[],
  warnings: string[],
): DomainHealth {
  let status: DomainHealth['status']
  if (score >= 80)      status = 'HEALTHY'
  else if (score >= 60) status = 'DEGRADED'
  else if (score > 0)   status = 'CRITICAL'
  else                  status = 'UNCONFIGURED'
  if (blockers.length > 0) status = 'CRITICAL'

  return {
    domain,
    score:          Math.min(100, Math.max(0, score)),
    status,
    blockers,
    warnings,
    last_evaluated: new Date().toISOString(),
  }
}

// ── Risk level ────────────────────────────────────────────────────────────────

function computeRiskLevel(totalBlockers: number, avgScore: number): InstitutionalRiskSummary['risk_level'] {
  if (totalBlockers >= 5 || avgScore < 40) return 'CRITICAL'
  if (totalBlockers >= 3 || avgScore < 60) return 'HIGH'
  if (totalBlockers >= 1 || avgScore < 75) return 'MEDIUM'
  if (avgScore < 90)                       return 'LOW'
  return 'MINIMAL'
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runFullSystemOperationalCommandCenter(
  tenantId?: string,
): Promise<FullSystemCommandReport> {
  const tid   = tenantId ?? TENANT_ID
  const start = Date.now()

  log.info('[fullSystemCommandCenter] starting', { tenantId: tid })

  // Run all Wave 51 domain reports + Wave 50 reality center in parallel
  const [
    realityCenterW50,
    systemAudit,
    dashboardHardening,
    capitalHardening,
    providerReality,
    securityHardening,
    drChaos,
    mlTruth,
    complianceEvidence,
  ] = await Promise.allSettled([
    runLiveInstitutionalRealityCenter(tid),
    runFullSystemRealityAudit(tid),
    runAbsoluteDashboardHardening(tid),
    runCapitalExecutionHardening(tid),
    runProviderRealityHardening(tid),
    runLiveSecurityHardening(tid),
    runDrChaosTruth(tid),
    runMlDataTruthHardening(tid),
    runComplianceEvidenceHardening(tid),
  ])

  // Extract values with safe fallback
  const rc   = realityCenterW50.status   === 'fulfilled' ? realityCenterW50.value   : null
  const sa   = systemAudit.status        === 'fulfilled' ? systemAudit.value        : null
  const dh   = dashboardHardening.status === 'fulfilled' ? dashboardHardening.value : null
  const cap  = capitalHardening.status   === 'fulfilled' ? capitalHardening.value   : null
  const prov = providerReality.status    === 'fulfilled' ? providerReality.value    : null
  const sec  = securityHardening.status  === 'fulfilled' ? securityHardening.value  : null
  const dr   = drChaos.status            === 'fulfilled' ? drChaos.value            : null
  const ml   = mlTruth.status            === 'fulfilled' ? mlTruth.value            : null
  const comp = complianceEvidence.status === 'fulfilled' ? complianceEvidence.value : null

  // Build domain health entries
  const domainHealth: Record<DomainName, DomainHealth> = {
    production:       makeDomainHealth('production',      prov?.provider_truth_index ?? 0, [], prov?.recommendations ?? []),
    financial:        makeDomainHealth('financial',       cap?.capital_execution_score ?? 0, cap?.blockers ?? [], cap?.warnings ?? []),
    security:         makeDomainHealth('security',        sec?.security_score ?? 0, sec?.blockers ?? [], sec?.warnings ?? []),
    compliance:       makeDomainHealth('compliance',      comp?.compliance_score ?? 0, comp?.blockers ?? [], comp?.warnings ?? []),
    resilience:       makeDomainHealth('resilience',      dr?.resilience_score ?? 0, dr?.blockers ?? [], dr?.warnings ?? []),
    ml:               makeDomainHealth('ml',              ml?.ml_truth_score ?? 0, ml?.blockers ?? [], ml?.warnings ?? []),
    capital:          makeDomainHealth('capital',         cap?.capital_execution_score ?? 0, cap?.blockers ?? [], cap?.warnings ?? []),
    dashboard:        makeDomainHealth('dashboard',       dh?.overall_score ?? 0, dh?.critical_issues ?? [], dh?.recommendations ?? []),
    audit:            makeDomainHealth('audit',           sa?.reality_coverage_pct ?? 0, [], sa?.recommendations ?? []),
    operations_w50:   makeDomainHealth('operations_w50',  rc?.global_reality_score ?? 0, [], []),
    certification_w50: makeDomainHealth('certification_w50', rc?.global_reality_score ?? 0, [], []),
  }

  const domainNames = Object.keys(domainHealth) as DomainName[]
  const scores      = domainNames.map(d => domainHealth[d].score)
  const avgScore    = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

  // Total blockers/warnings
  const allBlockers = domainNames.flatMap(d => domainHealth[d].blockers)
  const allWarnings = domainNames.flatMap(d => domainHealth[d].warnings)

  const highestRiskDomain = allBlockers.length > 0
    ? domainNames.reduce((worst, d) =>
        domainHealth[d].blockers.length > domainHealth[worst].blockers.length ? d : worst,
      domainNames[0]!)
    : null

  const riskSummary: InstitutionalRiskSummary = {
    total_blockers:      allBlockers.length,
    total_warnings:      allWarnings.length,
    highest_risk_domain: highestRiskDomain,
    risk_level:          computeRiskLevel(allBlockers.length, avgScore),
    immediate_actions:   allBlockers.slice(0, 5),
  }

  // System trends (static for now — would be computed from historical scores)
  const systemTrends: SystemTrend[] = domainNames.map(d => ({
    domain:             d,
    trend:              'STABLE' as const,
    delta_score:        0,
    trend_window_hours: 24,
  }))

  // Wave 51 score (weighted by domain criticality)
  const w51Score = Math.round(
    (domainHealth.financial.score  * 0.20) +
    (domainHealth.security.score   * 0.20) +
    (domainHealth.production.score * 0.15) +
    (domainHealth.capital.score    * 0.15) +
    (domainHealth.resilience.score * 0.10) +
    (domainHealth.compliance.score * 0.10) +
    (domainHealth.ml.score         * 0.05) +
    (domainHealth.dashboard.score  * 0.05),
  )

  const w50Score   = rc?.global_reality_score ?? 0
  const blendedScore = Math.round(w51Score * 0.70 + w50Score * 0.30)

  let cmdStatus: CommandCenterStatus
  if (riskSummary.total_blockers > 0)              cmdStatus = 'OPERATIONALLY_CRITICAL'
  else if (blendedScore >= 95 && avgScore >= 90)    cmdStatus = 'FULLY_OPERATIONAL'
  else if (blendedScore >= COMMAND_CENTER_HEALTHY_SCORE) cmdStatus = 'OPERATIONALLY_HEALTHY'
  else if (blendedScore >= COMMAND_CENTER_DEGRADED_SCORE) cmdStatus = 'OPERATIONALLY_DEGRADED'
  else                                              cmdStatus = 'SYSTEM_OFFLINE'

  const hardeningStatus: FullSystemCommandReport['system_hardening_status'] =
    cmdStatus === 'FULLY_OPERATIONAL'
      ? 'FULLY_HARDENED_INSTITUTIONAL_REAL_ESTATE_CAPITAL_OPERATING_SYSTEM'
      : blendedScore >= 60
        ? 'PARTIALLY_HARDENED'
        : 'NOT_HARDENED'

  const commandHash = createHash('sha256')
    .update(`COMMAND|${tid}|${cmdStatus}|${blendedScore}|${new Date().toISOString().split('T')[0]}`)
    .digest('hex')

  const report: FullSystemCommandReport = {
    command_id:                 randomUUID(),
    tenant_id:                  tid,
    command_status:             cmdStatus,
    system_health_score:        blendedScore,
    w51_score:                  w51Score,
    w50_score:                  w50Score,
    blended_score:              blendedScore,
    domain_health:              domainHealth,
    system_trends:              systemTrends,
    risk_summary:               riskSummary,
    system_hardening_status:    hardeningStatus,
    providers_operational:      (prov?.provider_truth_index ?? 0) >= 70,
    capital_integrity_proven:   (cap?.zero_orphan_capital ?? false) && (cap?.zero_duplicate_payments ?? false),
    security_certified:         sec?.security_status === 'SECURITY_CERTIFIED' || sec?.security_status === 'SECURITY_OPERATIONAL',
    resilience_certified:       dr?.dr_status === 'DR_CERTIFIED' || dr?.dr_status === 'DR_OPERATIONAL',
    ml_stable:                  ml?.ml_status === 'ML_CERTIFIED' || ml?.ml_status === 'ML_OPERATIONAL',
    compliance_evidence_ready:  comp?.big4_ready ?? false,
    command_hash:               commandHash,
    generated_at:               new Date().toISOString(),
  }

  const { error } = await (supabaseAdmin as unknown as { from: (t: string) => { insert: (v: unknown) => { error: unknown } } })
    .from('full_system_command_reports')
    .insert({
      command_id:              report.command_id,
      tenant_id:               tid,
      command_status:          report.command_status,
      blended_score:           report.blended_score,
      w51_score:               report.w51_score,
      w50_score:               report.w50_score,
      total_blockers:          riskSummary.total_blockers,
      risk_level:              riskSummary.risk_level,
      hardening_status:        report.system_hardening_status,
      command_hash:            report.command_hash,
      report_json:             JSON.stringify(report),
      generated_at:            report.generated_at,
    })
  if (error) log.warn('[fullSystemCommandCenter] persist failed', { error })

  log.info('[fullSystemCommandCenter] complete', {
    status:     cmdStatus,
    blended:    blendedScore,
    blockers:   riskSummary.total_blockers,
    durationMs: Date.now() - start,
  })

  return report
}
