// Agency Group — Production Readiness Report Generator
// lib/validation/productionReadinessReport.ts
// TypeScript strict — 0 errors
//
// Generates the final production readiness report combining:
// - System truth audit results
// - Gap detection report
// - Test suite results
// - Security hardening results
// - Sovereign readiness
// - Production readiness score

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import {
  computeProductionReadiness,
  getLatestProductionReadinessScore,
  type ProductionReadinessScore,
} from './productionReadinessScorer'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductionReadinessReport {
  report_id: string
  tenant_id: string

  // Architecture health
  architecture_health: {
    component_count: number
    critical_paths_verified: boolean
    api_routes_count: number
    typescript_errors: number
    last_architecture_scan_at: string | null
  }

  // Financial integrity status
  financial_integrity: {
    ledger_balanced: boolean
    escrow_consistent: boolean
    settlement_correct: boolean
    anomaly_count: number
    integrity_score: number
    last_audited_at: string | null
  }

  // Market simulation stability
  market_simulation: {
    last_simulation_grade: string | null
    bid_competition_ratio: number | null
    price_convergence: boolean | null
    market_depth_adequate: boolean | null
    last_run_at: string | null
  }

  // ML readiness
  ml_readiness: {
    model_current: boolean
    drift_detected: boolean
    psi_score: number | null
    last_retrain_days_ago: number | null
    stability_score: number
  }

  // Security posture
  security_posture: {
    hardening_passed: boolean
    pentest_posture: string | null
    critical_vulns: number
    secrets_clean: boolean
    audit_integrity_score: number
  }

  // Infrastructure resilience
  infra_resilience: {
    resilience_score: number | null
    rto_met: boolean | null
    rpo_zero: boolean | null
    last_drill_at: string | null
  }

  // Production readiness score
  readiness_score: ProductionReadinessScore

  // Final verdict
  production_ready: boolean
  verdict: string
  blocking_issues: string[]

  generated_at: string
}

// ─── Section loaders ──────────────────────────────────────────────────────────

export async function loadArchitectureHealth(
  tenantId: string,
): Promise<ProductionReadinessReport['architecture_health']> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('architecture_scan_results')
      .select('component_count, critical_paths_verified, api_routes_count, typescript_errors, scanned_at')
      .eq('tenant_id', tenantId)
      .order('scanned_at', { ascending: false })
      .limit(1)
      .single() as {
        data: {
          component_count: number
          critical_paths_verified: boolean
          api_routes_count: number
          typescript_errors: number
          scanned_at: string
        } | null
        error: unknown
      }

    if (data) {
      return {
        component_count:           Number(data.component_count ?? 0),
        critical_paths_verified:   Boolean(data.critical_paths_verified),
        api_routes_count:          Number(data.api_routes_count ?? 0),
        typescript_errors:         Number(data.typescript_errors ?? 0),
        last_architecture_scan_at: data.scanned_at,
      }
    }
  } catch {
    // no data
  }

  return {
    component_count:           0,
    critical_paths_verified:   false,
    api_routes_count:          0,
    typescript_errors:         0,
    last_architecture_scan_at: null,
  }
}

export async function loadFinancialIntegrity(
  tenantId: string,
): Promise<ProductionReadinessReport['financial_integrity']> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('financial_consistency_audits')
      .select('overall_score, ledger_balance, escrow_integrity, settlement_correctness, anomaly_count, audited_at')
      .eq('tenant_id', tenantId)
      .order('audited_at', { ascending: false })
      .limit(1)
      .single() as {
        data: {
          overall_score: number
          ledger_balance: { balance_reconciled?: boolean } | null
          escrow_integrity: { consistent?: boolean } | null
          settlement_correctness: { correct?: boolean } | null
          anomaly_count: number
          audited_at: string
        } | null
        error: unknown
      }

    if (data) {
      return {
        ledger_balanced:   Boolean(data.ledger_balance?.balance_reconciled),
        escrow_consistent: Boolean(data.escrow_integrity?.consistent),
        settlement_correct: Boolean(data.settlement_correctness?.correct),
        anomaly_count:     Number(data.anomaly_count ?? 0),
        integrity_score:   Number(data.overall_score ?? 0),
        last_audited_at:   data.audited_at,
      }
    }
  } catch {
    // no data
  }

  return {
    ledger_balanced:   false,
    escrow_consistent: false,
    settlement_correct: false,
    anomaly_count:     0,
    integrity_score:   0,
    last_audited_at:   null,
  }
}

export async function loadMarketSimulation(
  tenantId: string,
): Promise<ProductionReadinessReport['market_simulation']> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('market_simulation_results')
      .select('simulation_grade, bid_competition_ratio, price_convergence, market_depth_adequate, simulated_at')
      .eq('tenant_id', tenantId)
      .order('simulated_at', { ascending: false })
      .limit(1)
      .single() as {
        data: {
          simulation_grade: string
          bid_competition_ratio: number
          price_convergence: boolean
          market_depth_adequate: boolean
          simulated_at: string
        } | null
        error: unknown
      }

    if (data) {
      return {
        last_simulation_grade:  data.simulation_grade ?? null,
        bid_competition_ratio:  data.bid_competition_ratio != null ? Number(data.bid_competition_ratio) : null,
        price_convergence:      data.price_convergence != null ? Boolean(data.price_convergence) : null,
        market_depth_adequate:  data.market_depth_adequate != null ? Boolean(data.market_depth_adequate) : null,
        last_run_at:            data.simulated_at,
      }
    }
  } catch {
    // no data
  }

  return {
    last_simulation_grade:  null,
    bid_competition_ratio:  null,
    price_convergence:      null,
    market_depth_adequate:  null,
    last_run_at:            null,
  }
}

export async function loadMLReadiness(
  tenantId: string,
): Promise<ProductionReadinessReport['ml_readiness']> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('ml_consistency_audits')
      .select('overall_score, drift_analysis, last_retrain_at, audited_at')
      .eq('tenant_id', tenantId)
      .order('audited_at', { ascending: false })
      .limit(1)
      .single() as {
        data: {
          overall_score: number
          drift_analysis: { psi_estimate?: number; drift_detected?: boolean } | null
          last_retrain_at: string | null
          audited_at: string
        } | null
        error: unknown
      }

    if (data) {
      const psi           = data.drift_analysis?.psi_estimate ?? null
      const driftDetected = data.drift_analysis?.drift_detected ?? (psi !== null && psi > 0.2)
      const retrain       = data.last_retrain_at
        ? Math.floor((Date.now() - new Date(data.last_retrain_at).getTime()) / 86_400_000)
        : null

      return {
        model_current:         retrain !== null && retrain <= 30,
        drift_detected:        Boolean(driftDetected),
        psi_score:             psi,
        last_retrain_days_ago: retrain,
        stability_score:       Number(data.overall_score ?? 0),
      }
    }
  } catch {
    // no data
  }

  return {
    model_current:         false,
    drift_detected:        false,
    psi_score:             null,
    last_retrain_days_ago: null,
    stability_score:       0,
  }
}

export async function loadSecurityPosture(
  tenantId: string,
): Promise<ProductionReadinessReport['security_posture']> {
  // Query security_hardening_reports
  let hardeningPassed   = false
  let criticalVulns     = 0
  let secretsClean      = false
  let auditScore        = 0

  try {
    const { data } = await (supabaseAdmin as any)
      .from('security_hardening_reports')
      .select('hardening_passed, critical_vuln_count, secrets_clean, audit_integrity_score, generated_at')
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single() as {
        data: {
          hardening_passed: boolean
          critical_vuln_count: number
          secrets_clean: boolean
          audit_integrity_score: number
          generated_at: string
        } | null
        error: unknown
      }

    if (data) {
      hardeningPassed = Boolean(data.hardening_passed)
      criticalVulns   = Number(data.critical_vuln_count ?? 0)
      secretsClean    = Boolean(data.secrets_clean)
      auditScore      = Number(data.audit_integrity_score ?? 0)
    }
  } catch {
    // no data
  }

  // Query penetration_test_results for posture
  let pentestPosture: string | null = null

  try {
    const { data: ptData } = await (supabaseAdmin as any)
      .from('penetration_test_results')
      .select('posture, tested_at')
      .eq('tenant_id', tenantId)
      .order('tested_at', { ascending: false })
      .limit(1)
      .single() as {
        data: { posture: string; tested_at: string } | null
        error: unknown
      }

    if (ptData) {
      pentestPosture = ptData.posture ?? null
    }
  } catch {
    // no data
  }

  return {
    hardening_passed:      hardeningPassed,
    pentest_posture:       pentestPosture,
    critical_vulns:        criticalVulns,
    secrets_clean:         secretsClean,
    audit_integrity_score: auditScore,
  }
}

export async function loadInfraResilience(
  tenantId: string,
): Promise<ProductionReadinessReport['infra_resilience']> {
  let resilienceScore: number | null = null
  let lastDrillAt: string | null     = null

  // Query chaos_gauntlet_results
  try {
    const { data } = await (supabaseAdmin as any)
      .from('chaos_gauntlet_results')
      .select('resilience_score, executed_at')
      .eq('tenant_id', tenantId)
      .order('executed_at', { ascending: false })
      .limit(1)
      .single() as {
        data: { resilience_score: number; executed_at: string } | null
        error: unknown
      }

    if (data) {
      resilienceScore = Number(data.resilience_score)
      lastDrillAt     = data.executed_at
    }
  } catch {
    // no data
  }

  // Query recovery_metrics for RTO/RPO
  let rtoMet: boolean | null  = null
  let rpoZero: boolean | null = null

  try {
    const { data: rmData } = await (supabaseAdmin as any)
      .from('recovery_metrics')
      .select('rto_slo_met, actual_rpo_minutes, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as {
        data: { rto_slo_met: boolean; actual_rpo_minutes: number; created_at: string } | null
        error: unknown
      }

    if (rmData) {
      rtoMet  = Boolean(rmData.rto_slo_met)
      rpoZero = Number(rmData.actual_rpo_minutes) === 0
    }
  } catch {
    // no data
  }

  return {
    resilience_score: resilienceScore,
    rto_met:          rtoMet,
    rpo_zero:         rpoZero,
    last_drill_at:    lastDrillAt,
  }
}

// ─── persistReport ────────────────────────────────────────────────────────────

export async function persistReport(report: ProductionReadinessReport): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('production_readiness_reports')
    .insert({
      id:                   report.report_id,
      tenant_id:            report.tenant_id,
      architecture_health:  report.architecture_health,
      financial_integrity:  report.financial_integrity,
      market_simulation:    report.market_simulation,
      ml_readiness:         report.ml_readiness,
      security_posture:     report.security_posture,
      infra_resilience:     report.infra_resilience,
      readiness_score:      report.readiness_score,
      production_ready:     report.production_ready,
      verdict:              report.verdict,
      blocking_issues:      report.blocking_issues,
      generated_at:         report.generated_at,
    })

  if (error) {
    log.warn('[productionReadinessReport] DB persist error', { error: error.message })
  }
}

// ─── generateProductionReadinessReport ───────────────────────────────────────

export async function generateProductionReadinessReport(
  tenantId: string,
): Promise<ProductionReadinessReport> {
  const reportId    = randomUUID()
  const generatedAt = new Date().toISOString()

  log.info('[productionReadinessReport] generating report', { tenant_id: tenantId })

  // Load all sections in parallel
  const [
    architectureHealth,
    financialIntegrity,
    marketSimulation,
    mlReadiness,
    securityPosture,
    infraResilience,
    readinessScore,
  ] = await Promise.all([
    loadArchitectureHealth(tenantId),
    loadFinancialIntegrity(tenantId),
    loadMarketSimulation(tenantId),
    loadMLReadiness(tenantId),
    loadSecurityPosture(tenantId),
    loadInfraResilience(tenantId),
    computeProductionReadiness(tenantId),
  ])

  const productionReady  = readinessScore.verdict === 'PRODUCTION_READY'
  const blockingIssues   = readinessScore.blocking_reasons

  const verdict = productionReady
    ? `PRODUCTION READY — Score ${readinessScore.total_score}/100`
    : readinessScore.verdict === 'BLOCKED'
      ? `BLOCKED — ${blockingIssues.length} stop condition(s) triggered`
      : `NEEDS REMEDIATION — Score ${readinessScore.total_score}/100`

  const report: ProductionReadinessReport = {
    report_id:           reportId,
    tenant_id:           tenantId,
    architecture_health: architectureHealth,
    financial_integrity: financialIntegrity,
    market_simulation:   marketSimulation,
    ml_readiness:        mlReadiness,
    security_posture:    securityPosture,
    infra_resilience:    infraResilience,
    readiness_score:     readinessScore,
    production_ready:    productionReady,
    verdict,
    blocking_issues:     blockingIssues,
    generated_at:        generatedAt,
  }

  log.info('[productionReadinessReport] report generated', {
    tenant_id:        tenantId,
    production_ready: productionReady,
    verdict,
    score:            readinessScore.total_score,
    blocking_count:   blockingIssues.length,
  })

  // Fire-and-forget persist
  void persistReport(report).catch(e =>
    log.warn('[productionReadinessReport] persist failed', {
      error: e instanceof Error ? e.message : String(e),
    })
  )

  return report
}

// ─── getLatestProductionReadinessReport ──────────────────────────────────────

export async function getLatestProductionReadinessReport(
  tenantId: string,
): Promise<ProductionReadinessReport | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('production_readiness_reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null

    // Also fetch the latest score to embed
    const score = await getLatestProductionReadinessScore(tenantId)

    return {
      report_id:           String(data.id ?? ''),
      tenant_id:           String(data.tenant_id ?? ''),
      architecture_health: data.architecture_health as ProductionReadinessReport['architecture_health'],
      financial_integrity: data.financial_integrity as ProductionReadinessReport['financial_integrity'],
      market_simulation:   data.market_simulation   as ProductionReadinessReport['market_simulation'],
      ml_readiness:        data.ml_readiness         as ProductionReadinessReport['ml_readiness'],
      security_posture:    data.security_posture     as ProductionReadinessReport['security_posture'],
      infra_resilience:    data.infra_resilience     as ProductionReadinessReport['infra_resilience'],
      readiness_score:     (data.readiness_score as ProductionReadinessScore) ?? score ?? buildEmptyScore(tenantId),
      production_ready:    Boolean(data.production_ready),
      verdict:             String(data.verdict ?? 'BLOCKED'),
      blocking_issues:     (data.blocking_issues as string[]) ?? [],
      generated_at:        String(data.generated_at ?? ''),
    }
  } catch (err) {
    log.warn('[productionReadinessReport] getLatest error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEmptyScore(tenantId: string): ProductionReadinessScore {
  return {
    score_id:           '',
    tenant_id:          tenantId,
    dimensions: {
      integrity: { score: 0, weight: 0.25, weighted_contribution: 0, source: 'system_truth_audits', last_audit_at: null },
      financial: { score: 0, weight: 0.25, weighted_contribution: 0, balance_reconciled: false, anomaly_count: 0 },
      events:    { score: 0, weight: 0.20, weighted_contribution: 0, lost_events_estimate: 0, idempotency_score: 0 },
      ml:        { score: 0, weight: 0.15, weighted_contribution: 0, drift_psi: null, last_retrain_days_ago: null },
      security:  { score: 0, weight: 0.15, weighted_contribution: 0, hardening_passed: false, critical_vulns: 0 },
    },
    total_score:         0,
    stop_conditions:     [],
    production_blocked:  true,
    blocking_reasons:    ['No score data available'],
    verdict:             'BLOCKED',
    critical_actions:    ['Run POST /api/validation/production-readiness to generate first score'],
    recommended_actions: [],
    scored_at:           new Date().toISOString(),
  }
}
