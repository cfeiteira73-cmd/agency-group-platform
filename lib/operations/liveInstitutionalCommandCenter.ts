// Agency Group — Live Institutional Command Center
// lib/operations/liveInstitutionalCommandCenter.ts
// Wave 49 Phase 6 — True institutional operating center
//
// Aggregates: provider health, capital settlement, ML drift, liquidity health,
// threat landscape, compliance readiness, DR readiness, reconciliation truth,
// investor activity, infrastructure saturation.
// Global operational score, predictive failure alerts, institutional risk heatmap.
// TypeScript strict — 0 errors

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { runLiveProviderMeshReport, type ProviderTruthLabel } from '@/lib/providers/liveProviderOperationsMesh'
import { runLiveSettlementCoreReport, type FinancialTruthGrade } from '@/lib/banking/liveInstitutionalSettlementCore'
import { runLiveSocGridReport, type SocGridStatus } from '@/lib/security/liveInstitutionalSocGrid'
import { runRegulatoryRealitySystem, type ComplianceReadiness } from '@/lib/compliance/institutionalRegulatoryRealitySystem'
import { runLiveProductionChaosGrid, type ChaosGridStatus } from '@/lib/resilience/liveProductionChaosGrid'

// ── Constants ──────────────────────────────────────────────────────────────────

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ── Types ──────────────────────────────────────────────────────────────────────

export type OperationalReadiness =
  | 'FULLY_OPERATIONAL' | 'OPERATIONAL_WITH_WARNINGS' | 'DEGRADED'
  | 'CRITICAL' | 'PRE_OPERATIONAL'

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface DomainScore {
  domain: string
  score: number
  label: string
  risk: RiskLevel
  top_issue: string | null
}

export interface PredictiveAlert {
  alert_id: string
  domain: string
  prediction: string
  confidence_pct: number
  time_horizon: string
  recommended_action: string
}

export interface InstitutionalRiskHeatmap {
  provider_risk: RiskLevel
  financial_risk: RiskLevel
  security_risk: RiskLevel
  compliance_risk: RiskLevel
  resilience_risk: RiskLevel
  overall_risk: RiskLevel
}

export interface MlDriftStatus {
  drift_score: number | null     // 0.0–1.0
  below_threshold: boolean
  threshold: number
  last_checked_at: string | null
}

export interface LiquidityHealthStatus {
  active_locks: number
  orphan_capital_entries: number
  liquidity_score: number
}

export interface CommandCenterSnapshot {
  snapshot_id: string
  tenant_id: string
  captured_at: string
  // Global score
  global_operational_score: number
  operational_readiness: OperationalReadiness
  // Domain scores
  domain_scores: DomainScore[]
  // Aggregated key metrics
  provider_truth_index: number
  provider_truth_label: ProviderTruthLabel
  financial_truth_score: number
  financial_truth_grade: FinancialTruthGrade
  soc_grid_score: number
  soc_grid_status: SocGridStatus
  regulatory_score: number
  regulatory_readiness: ComplianceReadiness
  resilience_score: number
  chaos_grid_status: ChaosGridStatus
  // Extended metrics
  ml_drift: MlDriftStatus
  liquidity_health: LiquidityHealthStatus
  // Risk heatmap
  risk_heatmap: InstitutionalRiskHeatmap
  // Predictive alerts
  predictive_alerts: PredictiveAlert[]
  // Investor confidence (0-100)
  investor_confidence_score: number
  liquidity_confidence_score: number
  // Snapshot hash
  snapshot_hash: string
  issues: string[]
  recommendations: string[]
}

// ── ML drift check ─────────────────────────────────────────────────────────────

async function getMlDriftStatus(tenantId: string): Promise<MlDriftStatus> {
  const threshold = 0.2
  try {
    const { data } = await (supabaseAdmin as any)
      .from('ml_model_metrics')
      .select('drift_score, evaluated_at')
      .eq('tenant_id', tenantId)
      .order('evaluated_at', { ascending: false })
      .limit(1)

    const row = (data as Array<{ drift_score: number; evaluated_at: string }> | null)?.[0]
    if (!row) return { drift_score: null, below_threshold: true, threshold, last_checked_at: null }
    return {
      drift_score: row.drift_score, below_threshold: row.drift_score < threshold,
      threshold, last_checked_at: row.evaluated_at,
    }
  } catch {
    return { drift_score: null, below_threshold: true, threshold, last_checked_at: null }
  }
}

// ── Liquidity health ───────────────────────────────────────────────────────────

async function getLiquidityHealth(tenantId: string, settlementScore: number, orphanCount: number): Promise<LiquidityHealthStatus> {
  let activeLocks = 0
  try {
    const { count } = await (supabaseAdmin as any)
      .from('liquidity_locks')
      .select('lock_id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('unlocked_at', null)
    activeLocks = count ?? 0
  } catch { /* non-blocking */ }

  const baseScore = settlementScore
  const penaltyOrphan = orphanCount > 0 ? 20 : 0
  const penaltyLocks = activeLocks > 5 ? 10 : 0
  const liquidityScore = Math.max(0, Math.min(100, baseScore - penaltyOrphan - penaltyLocks))

  return { active_locks: activeLocks, orphan_capital_entries: orphanCount, liquidity_score: Math.round(liquidityScore) }
}

// ── Risk heatmap ───────────────────────────────────────────────────────────────

function computeRisk(score: number): RiskLevel {
  if (score >= 80) return 'LOW'
  if (score >= 60) return 'MEDIUM'
  if (score >= 40) return 'HIGH'
  return 'CRITICAL'
}

function buildRiskHeatmap(
  providerScore: number,
  financialScore: number,
  socScore: number,
  regulatoryScore: number,
  resilienceScore: number,
): InstitutionalRiskHeatmap {
  const overall = Math.round((providerScore + financialScore + socScore + regulatoryScore + resilienceScore) / 5)
  return {
    provider_risk: computeRisk(providerScore),
    financial_risk: computeRisk(financialScore),
    security_risk: computeRisk(socScore),
    compliance_risk: computeRisk(regulatoryScore),
    resilience_risk: computeRisk(resilienceScore),
    overall_risk: computeRisk(overall),
  }
}

// ── Predictive alerts ──────────────────────────────────────────────────────────

function buildPredictiveAlerts(
  providerScore: number,
  financialScore: number,
  socScore: number,
  regulatoryScore: number,
  resilienceScore: number,
  mlDrift: MlDriftStatus,
): PredictiveAlert[] {
  const alerts: PredictiveAlert[] = []
  const now = new Date().toISOString()

  if (providerScore < 60) {
    alerts.push({
      alert_id: randomUUID(), domain: 'PROVIDERS',
      prediction: 'Provider degradation trend — isolation likely within 24h without intervention',
      confidence_pct: 75, time_horizon: '24h',
      recommended_action: 'Configure backup provider env vars and verify fallback routing',
    })
  }
  if (financialScore < 80) {
    alerts.push({
      alert_id: randomUUID(), domain: 'FINANCIAL',
      prediction: 'Reconciliation drift risk — orphan capital may accumulate',
      confidence_pct: 70, time_horizon: '48h',
      recommended_action: 'Enable bank statement webhook and resolve pending mismatches',
    })
  }
  if (socScore < 70) {
    alerts.push({
      alert_id: randomUUID(), domain: 'SECURITY',
      prediction: 'Security posture degrading — undetected threats possible',
      confidence_pct: 65, time_horizon: '7d',
      recommended_action: 'Configure SIEM platform and enable PagerDuty escalation',
    })
  }
  if (mlDrift.drift_score !== null && !mlDrift.below_threshold) {
    alerts.push({
      alert_id: randomUUID(), domain: 'ML',
      prediction: 'ML model drift exceeds threshold — scoring accuracy degrading',
      confidence_pct: 85, time_horizon: '72h',
      recommended_action: 'Trigger model retraining pipeline',
    })
  }
  return alerts
}

// ── Global operational score ───────────────────────────────────────────────────

function computeGlobalScore(
  provider: number, financial: number, soc: number, regulatory: number, resilience: number,
): number {
  // Weighted: financial(30%) + security(25%) + regulatory(20%) + providers(15%) + resilience(10%)
  return Math.round(financial * 0.30 + soc * 0.25 + regulatory * 0.20 + provider * 0.15 + resilience * 0.10)
}

function operationalReadiness(score: number, heatmap: InstitutionalRiskHeatmap): OperationalReadiness {
  if (heatmap.financial_risk === 'CRITICAL' || heatmap.security_risk === 'CRITICAL') return 'CRITICAL'
  if (score >= 90) return 'FULLY_OPERATIONAL'
  if (score >= 75) return 'OPERATIONAL_WITH_WARNINGS'
  if (score >= 55) return 'DEGRADED'
  return 'PRE_OPERATIONAL'
}

// ── Confidence scores ─────────────────────────────────────────────────────────

function computeInvestorConfidence(financialScore: number, regulatoryScore: number, socScore: number): number {
  return Math.round(financialScore * 0.5 + regulatoryScore * 0.3 + socScore * 0.2)
}

function computeLiquidityConfidence(financialScore: number, liquidityScore: number): number {
  return Math.round(financialScore * 0.6 + liquidityScore * 0.4)
}

// ── Persist ────────────────────────────────────────────────────────────────────

async function persist(snapshot: CommandCenterSnapshot): Promise<void> {
  try {
    await (supabaseAdmin as any).from('command_center_snapshots').insert({
      snapshot_id: snapshot.snapshot_id, tenant_id: snapshot.tenant_id, captured_at: snapshot.captured_at,
      global_operational_score: snapshot.global_operational_score,
      operational_readiness: snapshot.operational_readiness,
      provider_truth_index: snapshot.provider_truth_index,
      financial_truth_score: snapshot.financial_truth_score,
      soc_grid_score: snapshot.soc_grid_score, regulatory_score: snapshot.regulatory_score,
      resilience_score: snapshot.resilience_score, investor_confidence_score: snapshot.investor_confidence_score,
      snapshot_hash: snapshot.snapshot_hash, issues: snapshot.issues,
    })
  } catch (e) { log.warn('[commandCenter] persist failed', { e: String(e) }) }
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function runLiveCommandCenter(tenantId?: string): Promise<CommandCenterSnapshot> {
  const tid = tenantId ?? TENANT_ID
  const snapshotId = randomUUID()

  // Run all 5 sub-reports in parallel — each fails gracefully
  const [providerReport, settlementReport, socReport, regulatoryReport, chaosReport] = await Promise.all([
    runLiveProviderMeshReport(tid).catch(() => null),
    runLiveSettlementCoreReport(tid).catch(() => null),
    runLiveSocGridReport(tid).catch(() => null),
    runRegulatoryRealitySystem(tid).catch(() => null),
    runLiveProductionChaosGrid(tid, false, 'SAFE_DRY_RUN').catch(() => null),
  ])

  const [mlDrift, liquidityHealth] = await Promise.all([
    getMlDriftStatus(tid),
    getLiquidityHealth(tid, settlementReport?.financial_truth_score ?? 50, settlementReport?.orphan_capital_entries ?? 0),
  ])

  const providerScore    = providerReport?.provider_truth_index     ?? 0
  const financialScore   = settlementReport?.financial_truth_score  ?? 0
  const socScore         = socReport?.soc_grid_score                ?? 0
  const regulatoryScore  = regulatoryReport?.regulatory_score       ?? 0
  const resilienceScore  = chaosReport?.resilience_score            ?? 0

  const globalScore = computeGlobalScore(providerScore, financialScore, socScore, regulatoryScore, resilienceScore)
  const riskHeatmap = buildRiskHeatmap(providerScore, financialScore, socScore, regulatoryScore, resilienceScore)
  const readiness = operationalReadiness(globalScore, riskHeatmap)
  const predictiveAlerts = buildPredictiveAlerts(providerScore, financialScore, socScore, regulatoryScore, resilienceScore, mlDrift)

  const domainScores: DomainScore[] = [
    { domain: 'PROVIDERS',   score: providerScore,   label: providerReport?.provider_truth_label   ?? 'UNCONFIGURED',    risk: computeRisk(providerScore),   top_issue: providerReport?.issues[0]    ?? null },
    { domain: 'FINANCIAL',   score: financialScore,  label: settlementReport?.financial_truth_grade ?? 'NO_DATA',         risk: computeRisk(financialScore),  top_issue: settlementReport?.issues[0]  ?? null },
    { domain: 'SECURITY',    score: socScore,        label: socReport?.soc_grid_status              ?? 'NOT_CONFIGURED',  risk: computeRisk(socScore),        top_issue: socReport?.issues[0]         ?? null },
    { domain: 'COMPLIANCE',  score: regulatoryScore, label: regulatoryReport?.regulatory_readiness  ?? 'NOT_READY',       risk: computeRisk(regulatoryScore), top_issue: regulatoryReport?.issues[0]  ?? null },
    { domain: 'RESILIENCE',  score: resilienceScore, label: chaosReport?.chaos_grid_status          ?? 'NOT_TESTED',      risk: computeRisk(resilienceScore), top_issue: chaosReport?.issues[0]       ?? null },
  ]

  const investorConfidence  = computeInvestorConfidence(financialScore, regulatoryScore, socScore)
  const liquidityConfidence = computeLiquidityConfidence(financialScore, liquidityHealth.liquidity_score)

  const snapshotPayload = `${tid}|${globalScore}|${providerScore}|${financialScore}|${socScore}|${regulatoryScore}|${resilienceScore}`
  const snapshotHash = createHash('sha256').update(snapshotPayload).digest('hex')

  const issues: string[] = [
    ...(providerReport?.issues    ?? []).slice(0, 2),
    ...(settlementReport?.issues  ?? []).slice(0, 2),
    ...(socReport?.issues         ?? []).slice(0, 2),
    ...(regulatoryReport?.issues  ?? []).slice(0, 2),
    ...(chaosReport?.issues       ?? []).slice(0, 2),
  ]
  const recommendations: string[] = [
    ...(providerReport?.recommendations    ?? []).slice(0, 1),
    ...(settlementReport?.recommendations  ?? []).slice(0, 1),
    ...(socReport?.recommendations         ?? []).slice(0, 1),
  ]

  const snapshot: CommandCenterSnapshot = {
    snapshot_id: snapshotId, tenant_id: tid, captured_at: new Date().toISOString(),
    global_operational_score: globalScore, operational_readiness: readiness,
    domain_scores: domainScores,
    provider_truth_index: providerScore, provider_truth_label: providerReport?.provider_truth_label ?? 'UNCONFIGURED',
    financial_truth_score: financialScore, financial_truth_grade: settlementReport?.financial_truth_grade ?? 'NO_DATA',
    soc_grid_score: socScore, soc_grid_status: socReport?.soc_grid_status ?? 'NOT_CONFIGURED',
    regulatory_score: regulatoryScore, regulatory_readiness: regulatoryReport?.regulatory_readiness ?? 'NOT_READY',
    resilience_score: resilienceScore, chaos_grid_status: chaosReport?.chaos_grid_status ?? 'NOT_TESTED',
    ml_drift: mlDrift, liquidity_health: liquidityHealth, risk_heatmap: riskHeatmap,
    predictive_alerts: predictiveAlerts,
    investor_confidence_score: investorConfidence, liquidity_confidence_score: liquidityConfidence,
    snapshot_hash: snapshotHash, issues, recommendations,
  }

  void persist(snapshot).catch((e: unknown) => log.warn('[commandCenter]', { e: String(e) }))
  return snapshot
}
