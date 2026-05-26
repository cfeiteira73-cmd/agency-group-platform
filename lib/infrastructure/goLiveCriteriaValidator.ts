// =============================================================================
// Agency Group — Go-Live Criteria Validator
// lib/infrastructure/goLiveCriteriaValidator.ts
//
// Validates the 6 Hard Stop Conditions for production-grade market infrastructure.
//
// Criteria:
//   1. ≥80% deals have real execution (not simulated)
//   2. Settlement confirmed by third parties (banks/PSPs)
//   3. ML drift < 0.2 vs real ROI
//   4. Supply ingestion continuous without critical gaps
//   5. Investor retention > 60% (capital lock-in real)
//   6. External price deviation < 5%
//
// TypeScript strict — 0 errors.
// EUR amounts in bigint cents. Fire-and-forget pattern for persistence.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type GoLiveStatus = 'PASS' | 'FAIL' | 'PARTIAL' | 'INSUFFICIENT_DATA'

export interface GoLiveCriterion {
  criterion_id: string
  criterion_name: string
  description: string
  status: GoLiveStatus
  current_value: number | null
  target_value: number
  unit: string           // '%', 'score', 'days', 'hours'
  blocking: boolean      // ALL 6 are blocking
  evidence: string       // what data was checked
  checked_at: string
}

export interface GoLiveAssessment {
  assessment_id: string
  tenant_id: string
  system_grade: 'PRODUCTION_GRADE_MARKET_INFRASTRUCTURE' | 'NEAR_READY' | 'DEVELOPMENT_STAGE' | 'EARLY_STAGE'
  go_live_ready: boolean   // ALL 6 criteria PASS
  criteria: GoLiveCriterion[]
  pass_count: number
  fail_count: number
  partial_count: number
  readiness_pct: number    // pass / 6 * 100
  estimated_days_to_ready: number | null
  assessed_at: string
  valid_until: string      // 24 hours
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString()
}

function isoPlus24h(): string {
  return new Date(Date.now() + 24 * 3600_000).toISOString()
}

// ─── Criterion 1: Real Execution ─────────────────────────────────────────────

/**
 * Reads capital_execution_pipelines: COMPLETED pipelines / total.
 * Target: ≥80%.
 */
export async function checkCriterion1_RealExecution(tenantId: string): Promise<GoLiveCriterion> {
  const base: Omit<GoLiveCriterion, 'status' | 'current_value' | 'evidence'> = {
    criterion_id: 'C1',
    criterion_name: 'Real Execution Rate',
    description: '≥80% of deals have real execution (not simulated)',
    target_value: 80,
    unit: '%',
    blocking: true,
    checked_at: nowIso(),
  }

  try {
    const { count: total } = await (supabaseAdmin as any)
      .from('capital_execution_pipelines')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    if (!total || total === 0) {
      return { ...base, status: 'INSUFFICIENT_DATA', current_value: null, evidence: 'No capital_execution_pipelines records found' }
    }

    const { count: completed } = await (supabaseAdmin as any)
      .from('capital_execution_pipelines')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'COMPLETED')

    const pct = ((completed ?? 0) / total) * 100
    const status: GoLiveStatus = pct >= 80 ? 'PASS' : pct >= 50 ? 'PARTIAL' : 'FAIL'

    return {
      ...base,
      status,
      current_value: Math.round(pct * 100) / 100,
      evidence: `${completed ?? 0} COMPLETED out of ${total} total pipelines`,
    }
  } catch (e) {
    log.warn('[goLiveCriteriaValidator] C1 check failed', { route: 'goLiveCriteriaValidator', error: String(e) })
    return { ...base, status: 'INSUFFICIENT_DATA', current_value: null, evidence: `Query failed: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ─── Criterion 2: Settlement Confirmation ────────────────────────────────────

/**
 * Reads capital_reality_checks: reality_status='REAL' count / total.
 * AND bank_reconciliation_runs count > 0 as evidence of third-party confirmation.
 * Target: ≥80% real.
 */
export async function checkCriterion2_SettlementConfirmation(tenantId: string): Promise<GoLiveCriterion> {
  const base: Omit<GoLiveCriterion, 'status' | 'current_value' | 'evidence'> = {
    criterion_id: 'C2',
    criterion_name: 'Settlement Confirmation',
    description: 'Settlement confirmed by third parties (banks/PSPs) — ≥80% reality_status=REAL',
    target_value: 80,
    unit: '%',
    blocking: true,
    checked_at: nowIso(),
  }

  try {
    const { count: total } = await (supabaseAdmin as any)
      .from('capital_reality_checks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    if (!total || total === 0) {
      return { ...base, status: 'INSUFFICIENT_DATA', current_value: null, evidence: 'No capital_reality_checks records found' }
    }

    const [{ count: realCount }, { count: bankRuns }] = await Promise.all([
      (supabaseAdmin as any)
        .from('capital_reality_checks')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('reality_status', 'REAL'),
      (supabaseAdmin as any)
        .from('bank_reconciliation_runs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ])

    const pct = ((realCount ?? 0) / total) * 100
    const hasBankConfirmation = (bankRuns ?? 0) > 0
    const status: GoLiveStatus = pct >= 80 && hasBankConfirmation ? 'PASS' : pct >= 80 ? 'PARTIAL' : pct >= 50 ? 'PARTIAL' : 'FAIL'

    return {
      ...base,
      status,
      current_value: Math.round(pct * 100) / 100,
      evidence: `${realCount ?? 0} REAL out of ${total} checks; bank_reconciliation_runs: ${bankRuns ?? 0}`,
    }
  } catch (e) {
    log.warn('[goLiveCriteriaValidator] C2 check failed', { route: 'goLiveCriteriaValidator', error: String(e) })
    return { ...base, status: 'INSUFFICIENT_DATA', current_value: null, evidence: `Query failed: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ─── Criterion 3: ML Drift ────────────────────────────────────────────────────

/**
 * Reads ml_reality_alignments: max drift_score across all models.
 * PASS if max drift < 0.2, PARTIAL if < 0.3, FAIL otherwise.
 */
export async function checkCriterion3_MLDrift(tenantId: string): Promise<GoLiveCriterion> {
  const base: Omit<GoLiveCriterion, 'status' | 'current_value' | 'evidence'> = {
    criterion_id: 'C3',
    criterion_name: 'ML Drift vs Real ROI',
    description: 'ML drift score < 0.2 vs real ROI — all models within threshold',
    target_value: 0.2,
    unit: 'score',
    blocking: true,
    checked_at: nowIso(),
  }

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('ml_reality_alignments')
      .select('drift_score, model_name')
      .eq('tenant_id', tenantId)
      .order('drift_score', { ascending: false })
      .limit(100)

    if (error || !data || (data as Record<string, unknown>[]).length === 0) {
      return { ...base, status: 'INSUFFICIENT_DATA', current_value: null, evidence: 'No ml_reality_alignments records found' }
    }

    const rows = data as { drift_score: number; model_name: string }[]
    const maxDrift = Math.max(...rows.map(r => Number(r.drift_score ?? 0)))
    const worstModel = rows[0]?.model_name ?? 'unknown'

    let status: GoLiveStatus
    if (maxDrift < 0.2) status = 'PASS'
    else if (maxDrift < 0.3) status = 'PARTIAL'
    else status = 'FAIL'

    return {
      ...base,
      status,
      current_value: Math.round(maxDrift * 10000) / 10000,
      evidence: `Max drift: ${maxDrift.toFixed(4)} (worst model: ${worstModel}) across ${rows.length} alignments`,
    }
  } catch (e) {
    log.warn('[goLiveCriteriaValidator] C3 check failed', { route: 'goLiveCriteriaValidator', error: String(e) })
    return { ...base, status: 'INSUFFICIENT_DATA', current_value: null, evidence: `Query failed: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ─── Criterion 4: Supply Ingestion ───────────────────────────────────────────

/**
 * Reads ingestion_runs: last run within 24h AND at least 2 providers succeeded.
 * current_value = hours since last run.
 */
export async function checkCriterion4_SupplyIngestion(tenantId: string): Promise<GoLiveCriterion> {
  const base: Omit<GoLiveCriterion, 'status' | 'current_value' | 'evidence'> = {
    criterion_id: 'C4',
    criterion_name: 'Supply Ingestion Continuity',
    description: 'Supply ingestion continuous — last run < 24h ago AND ≥2 providers succeeded',
    target_value: 24,
    unit: 'hours',
    blocking: true,
    checked_at: nowIso(),
  }

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('ingestion_runs')
      .select('started_at, providers_succeeded, status')
      .eq('tenant_id', tenantId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      return { ...base, status: 'INSUFFICIENT_DATA', current_value: null, evidence: 'No ingestion_runs records found' }
    }

    const row = data as { started_at: string; providers_succeeded: number; status: string }
    const lastRunAt = new Date(row.started_at).getTime()
    const hoursSince = (Date.now() - lastRunAt) / 3600_000
    const providersOk = Number(row.providers_succeeded ?? 0) >= 2

    let status: GoLiveStatus
    if (hoursSince < 24 && providersOk) status = 'PASS'
    else if (hoursSince < 48) status = 'PARTIAL'
    else status = 'FAIL'

    return {
      ...base,
      status,
      current_value: Math.round(hoursSince * 100) / 100,
      evidence: `Last run: ${row.started_at} (${hoursSince.toFixed(1)}h ago), providers_succeeded: ${row.providers_succeeded}, status: ${row.status}`,
    }
  } catch (e) {
    log.warn('[goLiveCriteriaValidator] C4 check failed', { route: 'goLiveCriteriaValidator', error: String(e) })
    return { ...base, status: 'INSUFFICIENT_DATA', current_value: null, evidence: `Query failed: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ─── Criterion 5: Investor Retention ─────────────────────────────────────────

/**
 * Reads investor_lock_in_scores: investors with last_bid_days_ago < 90 / total.
 * Target: ≥60%. INSUFFICIENT_DATA if < 5 investors.
 */
export async function checkCriterion5_InvestorRetention(tenantId: string): Promise<GoLiveCriterion> {
  const base: Omit<GoLiveCriterion, 'status' | 'current_value' | 'evidence'> = {
    criterion_id: 'C5',
    criterion_name: 'Investor Retention',
    description: 'Investor retention > 60% — capital lock-in real (last bid < 90 days)',
    target_value: 60,
    unit: '%',
    blocking: true,
    checked_at: nowIso(),
  }

  try {
    const { count: total } = await (supabaseAdmin as any)
      .from('investor_lock_in_scores')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    if (!total || total < 5) {
      return {
        ...base,
        status: 'INSUFFICIENT_DATA',
        current_value: total ?? 0,
        evidence: `Only ${total ?? 0} investors tracked — need ≥5 for meaningful retention assessment`,
      }
    }

    const { count: active } = await (supabaseAdmin as any)
      .from('investor_lock_in_scores')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .lt('last_bid_days_ago', 90)

    const pct = ((active ?? 0) / total) * 100
    const status: GoLiveStatus = pct >= 60 ? 'PASS' : pct >= 40 ? 'PARTIAL' : 'FAIL'

    return {
      ...base,
      status,
      current_value: Math.round(pct * 100) / 100,
      evidence: `${active ?? 0} active investors (bid < 90 days) out of ${total} total`,
    }
  } catch (e) {
    log.warn('[goLiveCriteriaValidator] C5 check failed', { route: 'goLiveCriteriaValidator', error: String(e) })
    return { ...base, status: 'INSUFFICIENT_DATA', current_value: null, evidence: `Query failed: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ─── Criterion 6: External Price Deviation ───────────────────────────────────

/**
 * Reads price_comparisons: avg |gap_pct| across all comparisons.
 * Target: < 5%. INSUFFICIENT_DATA if < 10 comparisons.
 */
export async function checkCriterion6_PriceDeviation(tenantId: string): Promise<GoLiveCriterion> {
  const base: Omit<GoLiveCriterion, 'status' | 'current_value' | 'evidence'> = {
    criterion_id: 'C6',
    criterion_name: 'External Price Deviation',
    description: 'Average |gap_pct| vs external prices < 5% — pricing calibration confirmed',
    target_value: 5,
    unit: '%',
    blocking: true,
    checked_at: nowIso(),
  }

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('price_comparisons')
      .select('gap_pct')
      .eq('tenant_id', tenantId)
      .limit(1000)

    if (error || !data) {
      return { ...base, status: 'INSUFFICIENT_DATA', current_value: null, evidence: `price_comparisons query failed: ${error?.message ?? 'no data'}` }
    }

    const rows = data as { gap_pct: number }[]
    if (rows.length < 10) {
      return {
        ...base,
        status: 'INSUFFICIENT_DATA',
        current_value: rows.length,
        evidence: `Only ${rows.length} price comparisons — need ≥10 for meaningful deviation assessment`,
      }
    }

    const avgAbsGap = rows.reduce((sum, r) => sum + Math.abs(Number(r.gap_pct ?? 0)), 0) / rows.length
    const status: GoLiveStatus = avgAbsGap < 5 ? 'PASS' : avgAbsGap < 10 ? 'PARTIAL' : 'FAIL'

    return {
      ...base,
      status,
      current_value: Math.round(avgAbsGap * 100) / 100,
      evidence: `Avg |gap_pct|: ${avgAbsGap.toFixed(2)}% across ${rows.length} price comparisons`,
    }
  } catch (e) {
    log.warn('[goLiveCriteriaValidator] C6 check failed', { route: 'goLiveCriteriaValidator', error: String(e) })
    return { ...base, status: 'INSUFFICIENT_DATA', current_value: null, evidence: `Query failed: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ─── Run Full Assessment ──────────────────────────────────────────────────────

/**
 * Runs all 6 checks in Promise.allSettled, assembles assessment, persists to go_live_assessments.
 */
export async function runGoLiveAssessment(tenantId: string): Promise<GoLiveAssessment> {
  const assessedAt = nowIso()
  const assessmentId = crypto.randomUUID()

  const results = await Promise.allSettled([
    checkCriterion1_RealExecution(tenantId),
    checkCriterion2_SettlementConfirmation(tenantId),
    checkCriterion3_MLDrift(tenantId),
    checkCriterion4_SupplyIngestion(tenantId),
    checkCriterion5_InvestorRetention(tenantId),
    checkCriterion6_PriceDeviation(tenantId),
  ])

  // Extract criteria — use fallback for any rejected promises
  const criteria: GoLiveCriterion[] = results.map((result, idx) => {
    if (result.status === 'fulfilled') return result.value
    const id = `C${idx + 1}`
    log.warn(`[goLiveCriteriaValidator] Criterion ${id} threw unexpected error`, {
      route: 'goLiveCriteriaValidator',
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    })
    return {
      criterion_id: id,
      criterion_name: `Criterion ${id}`,
      description: 'Check failed with unexpected error',
      status: 'INSUFFICIENT_DATA' as GoLiveStatus,
      current_value: null,
      target_value: 0,
      unit: '',
      blocking: true,
      evidence: `Unexpected error: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
      checked_at: assessedAt,
    }
  })

  const pass_count = criteria.filter(c => c.status === 'PASS').length
  const fail_count = criteria.filter(c => c.status === 'FAIL').length
  const partial_count = criteria.filter(c => c.status === 'PARTIAL').length
  const go_live_ready = pass_count === 6

  let system_grade: GoLiveAssessment['system_grade']
  if (go_live_ready) {
    system_grade = 'PRODUCTION_GRADE_MARKET_INFRASTRUCTURE'
  } else if (pass_count >= 4 && fail_count === 0) {
    system_grade = 'NEAR_READY'
  } else if (pass_count >= 2) {
    system_grade = 'DEVELOPMENT_STAGE'
  } else {
    system_grade = 'EARLY_STAGE'
  }

  let estimated_days_to_ready: number | null
  if (go_live_ready) estimated_days_to_ready = 0
  else if (pass_count === 5) estimated_days_to_ready = 30
  else if (pass_count === 4) estimated_days_to_ready = 90
  else if (pass_count === 3) estimated_days_to_ready = 180
  else estimated_days_to_ready = null

  const assessment: GoLiveAssessment = {
    assessment_id: assessmentId,
    tenant_id: tenantId,
    system_grade,
    go_live_ready,
    criteria,
    pass_count,
    fail_count,
    partial_count,
    readiness_pct: Math.round((pass_count / 6) * 100 * 100) / 100,
    estimated_days_to_ready,
    assessed_at: assessedAt,
    valid_until: isoPlus24h(),
  }

  // Persist — fire-and-forget
  void (supabaseAdmin as any)
    .from('go_live_assessments')
    .insert({
      assessment_id: assessmentId,
      tenant_id: tenantId,
      system_grade,
      go_live_ready,
      criteria,
      pass_count,
      fail_count,
      partial_count,
      readiness_pct: assessment.readiness_pct,
      estimated_days_to_ready,
      assessed_at: assessedAt,
      valid_until: assessment.valid_until,
    })
    .catch((e: unknown) => console.warn('[goLiveCriteriaValidator] persist failed', e))

  log.info('[goLiveCriteriaValidator] Assessment complete', {
    route: 'goLiveCriteriaValidator',
    system_grade,
    pass_count,
    fail_count,
    go_live_ready,
  })

  return assessment
}

// ─── Get Latest Assessment ────────────────────────────────────────────────────

export async function getLatestAssessment(tenantId: string): Promise<GoLiveAssessment | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('go_live_assessments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('assessed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null

    const row = data as {
      assessment_id: string
      tenant_id: string
      system_grade: GoLiveAssessment['system_grade']
      go_live_ready: boolean
      criteria: GoLiveCriterion[]
      pass_count: number
      fail_count: number
      partial_count: number
      readiness_pct: number
      estimated_days_to_ready: number | null
      assessed_at: string
      valid_until: string
    }

    return {
      assessment_id: row.assessment_id,
      tenant_id: row.tenant_id,
      system_grade: row.system_grade,
      go_live_ready: row.go_live_ready,
      criteria: row.criteria ?? [],
      pass_count: row.pass_count,
      fail_count: row.fail_count,
      partial_count: row.partial_count,
      readiness_pct: Number(row.readiness_pct),
      estimated_days_to_ready: row.estimated_days_to_ready,
      assessed_at: row.assessed_at,
      valid_until: row.valid_until,
    }
  } catch (e) {
    log.warn('[goLiveCriteriaValidator] getLatestAssessment failed', { route: 'goLiveCriteriaValidator', error: String(e) })
    return null
  }
}
