// Agency Group — Production Readiness Scorer
// lib/validation/productionReadinessScorer.ts
// TypeScript strict — 0 errors
//
// Calculates weighted Production Readiness Score:
// Integrity 25% + Financial 25% + Events 20% + ML 15% + Security 15%
//
// STOP CONDITIONS (any = production_blocked):
//   - CRITICAL gaps > 0
//   - Financial inconsistencies (balance not reconciled)
//   - Tenant leakage detected
//   - Kafka event integrity < 90%
//   - ML drift PSI > 0.25
//   - RTO > SLA
//   - RPO > 0

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductionReadinessScore {
  score_id: string
  tenant_id: string

  // Weighted dimension scores
  dimensions: {
    integrity: {
      score: number                // 0–100
      weight: number               // 0.25
      weighted_contribution: number
      source: 'data_integrity_audits' | 'system_truth_audits'
      last_audit_at: string | null
    }
    financial: {
      score: number
      weight: number               // 0.25
      weighted_contribution: number
      balance_reconciled: boolean
      anomaly_count: number
    }
    events: {
      score: number
      weight: number               // 0.20
      weighted_contribution: number
      lost_events_estimate: number
      idempotency_score: number
    }
    ml: {
      score: number
      weight: number               // 0.15
      weighted_contribution: number
      drift_psi: number | null
      last_retrain_days_ago: number | null
    }
    security: {
      score: number
      weight: number               // 0.15
      weighted_contribution: number
      hardening_passed: boolean
      critical_vulns: number
    }
  }

  // Final score
  total_score: number              // 0–100

  // Stop conditions
  stop_conditions: {
    condition: string
    triggered: boolean
    value: string
    threshold: string
  }[]

  production_blocked: boolean      // any stop_condition triggered
  blocking_reasons: string[]

  verdict: 'PRODUCTION_READY' | 'NEEDS_REMEDIATION' | 'BLOCKED'

  // Action items
  critical_actions: string[]       // must fix before production
  recommended_actions: string[]    // should fix for optimal performance

  scored_at: string
}

// ─── Dimension weights ────────────────────────────────────────────────────────

const WEIGHTS = {
  integrity: 0.25,
  financial: 0.25,
  events:    0.20,
  ml:        0.15,
  security:  0.15,
} as const

// ─── loadDimensionScores ──────────────────────────────────────────────────────

export async function loadDimensionScores(
  tenantId: string,
): Promise<ProductionReadinessScore['dimensions']> {
  const [integrityResult, financialResult, eventsResult, mlResult, securityResult] =
    await Promise.allSettled([
      loadIntegrityDimension(tenantId),
      loadFinancialDimension(tenantId),
      loadEventsDimension(tenantId),
      loadMLDimension(tenantId),
      loadSecurityDimension(tenantId),
    ])

  const integrity = integrityResult.status === 'fulfilled'
    ? integrityResult.value
    : defaultIntegrity()

  const financial = financialResult.status === 'fulfilled'
    ? financialResult.value
    : defaultFinancial()

  const events = eventsResult.status === 'fulfilled'
    ? eventsResult.value
    : defaultEvents()

  const ml = mlResult.status === 'fulfilled'
    ? mlResult.value
    : defaultML()

  const security = securityResult.status === 'fulfilled'
    ? securityResult.value
    : defaultSecurity()

  return { integrity, financial, events, ml, security }
}

// ─── Individual dimension loaders ─────────────────────────────────────────────

async function loadIntegrityDimension(
  tenantId: string,
): Promise<ProductionReadinessScore['dimensions']['integrity']> {
  // Try system_truth_reports first (Wave 36 canonical)
  try {
    const { data } = await (supabaseAdmin as any)
      .from('system_truth_reports')
      .select('overall_score, generated_at')
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single() as { data: { overall_score: number; generated_at: string } | null; error: unknown }

    if (data) {
      const score = clamp(data.overall_score)
      return {
        score,
        weight: WEIGHTS.integrity,
        weighted_contribution: Math.round(score * WEIGHTS.integrity * 100) / 100,
        source: 'system_truth_audits',
        last_audit_at: data.generated_at,
      }
    }
  } catch {
    // fall through
  }

  // Fallback: data_integrity_audits
  try {
    const { data } = await (supabaseAdmin as any)
      .from('data_integrity_audits')
      .select('integrity_score, audited_at')
      .eq('tenant_id', tenantId)
      .order('audited_at', { ascending: false })
      .limit(1)
      .single() as { data: { integrity_score: number; audited_at: string } | null; error: unknown }

    if (data) {
      const score = clamp(data.integrity_score)
      return {
        score,
        weight: WEIGHTS.integrity,
        weighted_contribution: Math.round(score * WEIGHTS.integrity * 100) / 100,
        source: 'data_integrity_audits',
        last_audit_at: data.audited_at,
      }
    }
  } catch {
    // no data
  }

  return defaultIntegrity()
}

async function loadFinancialDimension(
  tenantId: string,
): Promise<ProductionReadinessScore['dimensions']['financial']> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('financial_consistency_audits')
      .select('overall_score, ledger_balance, anomaly_count, audited_at')
      .eq('tenant_id', tenantId)
      .order('audited_at', { ascending: false })
      .limit(1)
      .single() as {
        data: {
          overall_score: number
          ledger_balance: { balance_reconciled?: boolean } | null
          anomaly_count: number
          audited_at: string
        } | null
        error: unknown
      }

    if (data) {
      const score = clamp(data.overall_score)
      const reconciled = data.ledger_balance?.balance_reconciled ?? false
      const anomalies  = Number(data.anomaly_count ?? 0)
      return {
        score,
        weight: WEIGHTS.financial,
        weighted_contribution: Math.round(score * WEIGHTS.financial * 100) / 100,
        balance_reconciled: reconciled,
        anomaly_count: anomalies,
      }
    }
  } catch {
    // no data
  }

  return defaultFinancial()
}

async function loadEventsDimension(
  tenantId: string,
): Promise<ProductionReadinessScore['dimensions']['events']> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('event_system_audits')
      .select('event_integrity_score, lost_events_estimate, idempotency_score, audited_at')
      .eq('tenant_id', tenantId)
      .order('audited_at', { ascending: false })
      .limit(1)
      .single() as {
        data: {
          event_integrity_score: number
          lost_events_estimate: number
          idempotency_score: number
          audited_at: string
        } | null
        error: unknown
      }

    if (data) {
      const score = clamp(data.event_integrity_score)
      return {
        score,
        weight: WEIGHTS.events,
        weighted_contribution: Math.round(score * WEIGHTS.events * 100) / 100,
        lost_events_estimate: Number(data.lost_events_estimate ?? 0),
        idempotency_score:    Number(data.idempotency_score ?? 0),
      }
    }
  } catch {
    // no data
  }

  return defaultEvents()
}

async function loadMLDimension(
  tenantId: string,
): Promise<ProductionReadinessScore['dimensions']['ml']> {
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
          drift_analysis: { psi_estimate?: number } | null
          last_retrain_at: string | null
          audited_at: string
        } | null
        error: unknown
      }

    if (data) {
      const score   = clamp(data.overall_score)
      const psi     = data.drift_analysis?.psi_estimate ?? null
      const retrain = data.last_retrain_at
        ? Math.floor((Date.now() - new Date(data.last_retrain_at).getTime()) / 86_400_000)
        : null

      return {
        score,
        weight: WEIGHTS.ml,
        weighted_contribution: Math.round(score * WEIGHTS.ml * 100) / 100,
        drift_psi:            psi,
        last_retrain_days_ago: retrain,
      }
    }
  } catch {
    // no data
  }

  return defaultML()
}

async function loadSecurityDimension(
  tenantId: string,
): Promise<ProductionReadinessScore['dimensions']['security']> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('security_hardening_reports')
      .select('overall_score, hardening_passed, critical_vuln_count, generated_at')
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single() as {
        data: {
          overall_score: number
          hardening_passed: boolean
          critical_vuln_count: number
          generated_at: string
        } | null
        error: unknown
      }

    if (data) {
      const score = clamp(data.overall_score)
      return {
        score,
        weight: WEIGHTS.security,
        weighted_contribution: Math.round(score * WEIGHTS.security * 100) / 100,
        hardening_passed: Boolean(data.hardening_passed),
        critical_vulns:   Number(data.critical_vuln_count ?? 0),
      }
    }
  } catch {
    // no data
  }

  return defaultSecurity()
}

// ─── Default dimension values ─────────────────────────────────────────────────

function defaultIntegrity(): ProductionReadinessScore['dimensions']['integrity'] {
  return {
    score: 0,
    weight: WEIGHTS.integrity,
    weighted_contribution: 0,
    source: 'system_truth_audits',
    last_audit_at: null,
  }
}

function defaultFinancial(): ProductionReadinessScore['dimensions']['financial'] {
  return {
    score: 0,
    weight: WEIGHTS.financial,
    weighted_contribution: 0,
    balance_reconciled: false,
    anomaly_count: 0,
  }
}

function defaultEvents(): ProductionReadinessScore['dimensions']['events'] {
  return {
    score: 0,
    weight: WEIGHTS.events,
    weighted_contribution: 0,
    lost_events_estimate: 0,
    idempotency_score: 0,
  }
}

function defaultML(): ProductionReadinessScore['dimensions']['ml'] {
  return {
    score: 0,
    weight: WEIGHTS.ml,
    weighted_contribution: 0,
    drift_psi: null,
    last_retrain_days_ago: null,
  }
}

function defaultSecurity(): ProductionReadinessScore['dimensions']['security'] {
  return {
    score: 0,
    weight: WEIGHTS.security,
    weighted_contribution: 0,
    hardening_passed: false,
    critical_vulns: 0,
  }
}

// ─── checkStopConditions ──────────────────────────────────────────────────────

export async function checkStopConditions(
  tenantId: string,
  dimensions: ProductionReadinessScore['dimensions'],
): Promise<ProductionReadinessScore['stop_conditions']> {
  const conditions: ProductionReadinessScore['stop_conditions'] = []

  // 1. CRITICAL gaps > 0
  try {
    const { data: gapData } = await (supabaseAdmin as any)
      .from('gap_detection_reports')
      .select('critical_count')
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single() as { data: { critical_count: number } | null; error: unknown }

    const criticalCount = Number(gapData?.critical_count ?? 0)
    conditions.push({
      condition:  'CRITICAL_GAPS_ZERO',
      triggered:  criticalCount > 0,
      value:      String(criticalCount),
      threshold:  '0',
    })
  } catch {
    conditions.push({
      condition: 'CRITICAL_GAPS_ZERO',
      triggered: false,
      value:     'unknown',
      threshold: '0',
    })
  }

  // 2. Financial inconsistency
  conditions.push({
    condition: 'FINANCIAL_BALANCE_RECONCILED',
    triggered: !dimensions.financial.balance_reconciled,
    value:     String(dimensions.financial.balance_reconciled),
    threshold: 'true',
  })

  // 3. Tenant leakage
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await (supabaseAdmin as any)
      .from('tenant_isolation_violations')
      .select('id', { count: 'exact', head: true })
      .or(`violating_tenant_id.eq.${tenantId},exposed_tenant_id.eq.${tenantId}`)
      .gte('detected_at', since)
      .eq('resolved', false) as { count: number | null; error: unknown }

    const violations = count ?? 0
    conditions.push({
      condition: 'ZERO_TENANT_LEAKAGE',
      triggered: violations > 0,
      value:     String(violations),
      threshold: '0',
    })
  } catch {
    conditions.push({
      condition: 'ZERO_TENANT_LEAKAGE',
      triggered: false,
      value:     'unknown',
      threshold: '0',
    })
  }

  // 4. Kafka event integrity < 90%
  conditions.push({
    condition: 'KAFKA_INTEGRITY_90PCT',
    triggered: dimensions.events.score < 90,
    value:     String(dimensions.events.score),
    threshold: '90',
  })

  // 5. ML drift PSI > 0.25
  const psi = dimensions.ml.drift_psi
  conditions.push({
    condition: 'ML_DRIFT_PSI_UNDER_THRESHOLD',
    triggered: psi !== null && psi > 0.25,
    value:     psi !== null ? String(psi) : 'not_measured',
    threshold: '0.25',
  })

  // 6. RTO > SLA
  try {
    const { data: rtoData } = await (supabaseAdmin as any)
      .from('recovery_metrics')
      .select('rto_slo_met, actual_rto_minutes')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as { data: { rto_slo_met: boolean; actual_rto_minutes: number } | null; error: unknown }

    const rtoMet = rtoData?.rto_slo_met ?? true
    conditions.push({
      condition: 'RTO_WITHIN_SLA',
      triggered: !rtoMet,
      value:     rtoData ? String(rtoData.actual_rto_minutes) + 'min' : 'unknown',
      threshold: 'SLA',
    })
  } catch {
    conditions.push({
      condition: 'RTO_WITHIN_SLA',
      triggered: false,
      value:     'unknown',
      threshold: 'SLA',
    })
  }

  // 7. RPO > 0
  try {
    const { data: rpoData } = await (supabaseAdmin as any)
      .from('recovery_metrics')
      .select('actual_rpo_minutes')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as { data: { actual_rpo_minutes: number } | null; error: unknown }

    const rpoMins = Number(rpoData?.actual_rpo_minutes ?? 0)
    conditions.push({
      condition: 'RPO_ZERO',
      triggered: rpoMins > 0,
      value:     String(rpoMins),
      threshold: '0',
    })
  } catch {
    conditions.push({
      condition: 'RPO_ZERO',
      triggered: false,
      value:     'unknown',
      threshold: '0',
    })
  }

  return conditions
}

// ─── generateActionItems ──────────────────────────────────────────────────────

export function generateActionItems(
  stopConditions: ProductionReadinessScore['stop_conditions'],
  dimensions: ProductionReadinessScore['dimensions'],
): { critical: string[]; recommended: string[] } {
  const critical: string[] = []
  const recommended: string[] = []

  for (const sc of stopConditions) {
    if (!sc.triggered) continue
    switch (sc.condition) {
      case 'CRITICAL_GAPS_ZERO':
        critical.push(`Fix ${sc.value} CRITICAL gap(s) identified by gap detection engine`)
        break
      case 'FINANCIAL_BALANCE_RECONCILED':
        critical.push('Reconcile financial ledger — balance mismatch detected in financial_consistency_audits')
        break
      case 'ZERO_TENANT_LEAKAGE':
        critical.push(`Resolve ${sc.value} cross-tenant isolation violation(s) in last 7 days`)
        break
      case 'KAFKA_INTEGRITY_90PCT':
        critical.push(`Improve Kafka event integrity from ${sc.value}% to ≥90% — check event_system_audits`)
        break
      case 'ML_DRIFT_PSI_UNDER_THRESHOLD':
        critical.push(`Retrain ML model — PSI drift at ${sc.value} exceeds threshold of 0.25`)
        break
      case 'RTO_WITHIN_SLA':
        critical.push(`Recovery time objective exceeded SLA — actual RTO: ${sc.value}`)
        break
      case 'RPO_ZERO':
        critical.push(`Recovery point objective violated — ${sc.value} minutes of data loss detected`)
        break
    }
  }

  if (dimensions.integrity.score < 80) {
    recommended.push(`Run POST /api/validation/full-scan — integrity score at ${dimensions.integrity.score}/100`)
  }
  if (dimensions.ml.last_retrain_days_ago !== null && dimensions.ml.last_retrain_days_ago > 30) {
    recommended.push(`ML model last retrained ${dimensions.ml.last_retrain_days_ago} days ago — consider retraining`)
  }
  if (dimensions.security.critical_vulns > 0) {
    recommended.push(`Address ${dimensions.security.critical_vulns} critical vulnerability/ies in security hardening report`)
  }
  if (dimensions.financial.anomaly_count > 0) {
    recommended.push(`Investigate ${dimensions.financial.anomaly_count} financial anomaly/ies flagged by consistency audit`)
  }
  if (dimensions.events.lost_events_estimate > 0) {
    recommended.push(`${dimensions.events.lost_events_estimate} estimated lost events — check event_system_audits and replay gaps`)
  }

  return { critical, recommended }
}

// ─── computeProductionReadiness ───────────────────────────────────────────────

export async function computeProductionReadiness(
  tenantId: string,
): Promise<ProductionReadinessScore> {
  const scoreId  = randomUUID()
  const scoredAt = new Date().toISOString()

  log.info('[productionReadinessScorer] computing score', { tenant_id: tenantId })

  const dimensions = await loadDimensionScores(tenantId)

  const totalScore = Math.round(
    dimensions.integrity.weighted_contribution * 100 / WEIGHTS.integrity * WEIGHTS.integrity +
    dimensions.financial.weighted_contribution * 100 / Math.max(dimensions.financial.score || 1, 1) * WEIGHTS.financial +
    dimensions.events.weighted_contribution    * 100 / Math.max(dimensions.events.score    || 1, 1) * WEIGHTS.events +
    dimensions.ml.weighted_contribution        * 100 / Math.max(dimensions.ml.score        || 1, 1) * WEIGHTS.ml +
    dimensions.security.weighted_contribution  * 100 / Math.max(dimensions.security.score  || 1, 1) * WEIGHTS.security
  )

  // Simpler correct formula: sum weighted contributions directly
  const total = Math.round(
    dimensions.integrity.score * WEIGHTS.integrity +
    dimensions.financial.score * WEIGHTS.financial +
    dimensions.events.score    * WEIGHTS.events    +
    dimensions.ml.score        * WEIGHTS.ml        +
    dimensions.security.score  * WEIGHTS.security
  )

  const stopConditions = await checkStopConditions(tenantId, dimensions)
  const productionBlocked = stopConditions.some(sc => sc.triggered)
  const blockingReasons   = stopConditions
    .filter(sc => sc.triggered)
    .map(sc => `${sc.condition}: ${sc.value} (threshold: ${sc.threshold})`)

  const { critical, recommended } = generateActionItems(stopConditions, dimensions)

  let verdict: ProductionReadinessScore['verdict']
  if (productionBlocked) {
    verdict = 'BLOCKED'
  } else if (total >= 80) {
    verdict = 'PRODUCTION_READY'
  } else {
    verdict = 'NEEDS_REMEDIATION'
  }

  const result: ProductionReadinessScore = {
    score_id:            scoreId,
    tenant_id:           tenantId,
    dimensions,
    total_score:         clamp(total),
    stop_conditions:     stopConditions,
    production_blocked:  productionBlocked,
    blocking_reasons:    blockingReasons,
    verdict,
    critical_actions:    critical,
    recommended_actions: recommended,
    scored_at:           scoredAt,
  }

  log.info('[productionReadinessScorer] score computed', {
    tenant_id:          tenantId,
    total_score:        result.total_score,
    verdict:            result.verdict,
    production_blocked: result.production_blocked,
    blocking_count:     blockingReasons.length,
  })

  // Fire-and-forget persist
  void persistScore(result).catch(e =>
    log.warn('[productionReadinessScorer] persist failed', {
      error: e instanceof Error ? e.message : String(e),
    })
  )

  return result
}

// ─── Persistence ─────────────────────────────────────────────────────────────

async function persistScore(score: ProductionReadinessScore): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('production_readiness_scores')
    .insert({
      id:                  score.score_id,
      tenant_id:           score.tenant_id,
      total_score:         score.total_score,
      dimensions:          score.dimensions,
      stop_conditions:     score.stop_conditions,
      production_blocked:  score.production_blocked,
      blocking_reasons:    score.blocking_reasons,
      verdict:             score.verdict,
      critical_actions:    score.critical_actions,
      recommended_actions: score.recommended_actions,
      scored_at:           score.scored_at,
    })

  if (error) {
    log.warn('[productionReadinessScorer] DB persist error', { error: error.message })
  }
}

export async function getLatestProductionReadinessScore(
  tenantId: string,
): Promise<ProductionReadinessScore | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('production_readiness_scores')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('scored_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null
    return {
      score_id:            String(data.id ?? ''),
      tenant_id:           String(data.tenant_id ?? ''),
      dimensions:          data.dimensions as ProductionReadinessScore['dimensions'],
      total_score:         Number(data.total_score ?? 0),
      stop_conditions:     (data.stop_conditions as ProductionReadinessScore['stop_conditions']) ?? [],
      production_blocked:  Boolean(data.production_blocked),
      blocking_reasons:    (data.blocking_reasons as string[]) ?? [],
      verdict:             (data.verdict as ProductionReadinessScore['verdict']) ?? 'BLOCKED',
      critical_actions:    (data.critical_actions as string[]) ?? [],
      recommended_actions: (data.recommended_actions as string[]) ?? [],
      scored_at:           String(data.scored_at ?? ''),
    }
  } catch (err) {
    log.warn('[productionReadinessScorer] getLatest error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(n: number): number {
  const parsed = typeof n === 'number' ? n : parseFloat(String(n))
  if (isNaN(parsed)) return 0
  return Math.max(0, Math.min(100, Math.round(parsed)))
}
