// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Economic Consistency Engine
// lib/validation/economicConsistencyEngine.ts
//
// Layer 3 of the Autonomous Validation Engine.
// Validates that economic signals are internally consistent and that ML
// predictions track reality. All queries are READ-ONLY.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface EconomicTest {
  name: string
  passed: boolean
  score: number                              // 0–100
  actual: number | null
  expected_range: [number, number] | null
  details: string
}

export interface EconomicDriftReport {
  id: string
  tenant_id: string
  overall_score: number
  profit_model_accuracy_score: number        // 0–100
  mae: number | null                         // Mean Absolute Error of ROI predictions
  rmse: number | null                        // Root Mean Square Error
  prediction_bias: number | null             // avg(actual - predicted), positive = consistently under-predicts
  tests: EconomicTest[]
  economic_drift_detected: boolean
  drift_severity: 'none' | 'low' | 'medium' | 'high' | 'critical'
  sample_count: number
  tested_at: string
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

/** Mean Absolute Error */
export function computeMAE(pairs: Array<{ actual: number; predicted: number }>): number {
  if (pairs.length === 0) return 0
  const sum = pairs.reduce((s, p) => s + Math.abs(p.actual - p.predicted), 0)
  return round4(sum / pairs.length)
}

/** Root Mean Square Error */
export function computeRMSE(pairs: Array<{ actual: number; predicted: number }>): number {
  if (pairs.length === 0) return 0
  const sum = pairs.reduce((s, p) => s + (p.actual - p.predicted) ** 2, 0)
  return round4(Math.sqrt(sum / pairs.length))
}

/** Bias = avg(actual - predicted). Positive → model under-predicts. */
export function computeBias(pairs: Array<{ actual: number; predicted: number }>): number {
  if (pairs.length === 0) return 0
  const sum = pairs.reduce((s, p) => s + (p.actual - p.predicted), 0)
  return round4(sum / pairs.length)
}

// ─── Individual Tests ──────────────────────────────────────────────────────────

/**
 * Test 1 — scoring_decision_coherence
 * Top 20 properties by liquidity grade (S/A) should also have MPI > 50.
 * Pass threshold: >= 70% of S/A properties have MPI > 50.
 */
async function testScoringDecisionCoherence(tenantId: string): Promise<EconomicTest> {
  const name = 'scoring_decision_coherence'
  try {
    // Get the 20 most recent S or A grade snapshots
    const { data: snapshotRows, error: snapErr } = await (supabaseAdmin as any)
      .from('liquidity_snapshots')
      .select('property_id, liquidity_grade')
      .eq('tenant_id', tenantId)
      .in('liquidity_grade', ['S', 'A'])
      .order('snapshot_at', { ascending: false })
      .limit(20)

    if (snapErr) {
      log.warn('[economicConsistencyEngine] scoring_decision_coherence: liquidity_snapshots query failed', { error: snapErr.message })
      return {
        name,
        passed: false,
        score: 0,
        actual: null,
        expected_range: [0.7, 1.0],
        details: `Query error: ${snapErr.message}`,
      }
    }

    const rows = (snapshotRows ?? []) as Array<{ property_id: string; liquidity_grade: string }>
    if (rows.length === 0) {
      return {
        name,
        passed: true,
        score: 75,
        actual: null,
        expected_range: [0.7, 1.0],
        details: 'No S/A liquidity snapshots found — insufficient data, assuming pass',
      }
    }

    // For each property, get the latest MPI score
    const propertyIds = [...new Set(rows.map(r => r.property_id))]
    let highMpiCount = 0
    let checkedCount = 0

    for (const pid of propertyIds) {
      const { data: mpiRow } = await (supabaseAdmin as any)
        .from('market_pressure_snapshots')
        .select('mpi_score')
        .eq('tenant_id', tenantId)
        .eq('property_id', pid)
        .order('snapshot_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (mpiRow?.mpi_score != null) {
        checkedCount++
        if ((mpiRow.mpi_score as number) > 50) highMpiCount++
      }
    }

    if (checkedCount === 0) {
      return {
        name,
        passed: true,
        score: 70,
        actual: null,
        expected_range: [0.7, 1.0],
        details: 'No MPI scores found for S/A properties — insufficient data',
      }
    }

    const coherenceRatio = highMpiCount / checkedCount
    const passed = coherenceRatio >= 0.7
    const score = passed ? 100 : coherenceRatio >= 0.5 ? 50 : 20

    return {
      name,
      passed,
      score,
      actual: round4(coherenceRatio),
      expected_range: [0.7, 1.0],
      details: `${highMpiCount}/${checkedCount} S/A properties have MPI > 50 (ratio: ${(coherenceRatio * 100).toFixed(1)}%)`,
    }
  } catch (err) {
    log.error('[economicConsistencyEngine] scoring_decision_coherence failed', err instanceof Error ? err : undefined)
    return {
      name,
      passed: false,
      score: 0,
      actual: null,
      expected_range: [0.7, 1.0],
      details: `Exception: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/**
 * Test 2 — roi_prediction_accuracy
 * Reads roi_tracking and computes MAE / RMSE.
 * Score: 100 if MAE < 2%, 80 if < 5%, 50 if < 10%, 0 if >= 10%.
 */
async function testROIPredictionAccuracy(tenantId: string): Promise<{ test: EconomicTest; mae: number | null; rmse: number | null; bias: number | null; sampleCount: number }> {
  const name = 'roi_prediction_accuracy'
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('roi_tracking')
      .select('actual_roi_pct, predicted_roi_pct')
      .eq('tenant_id', tenantId)
      .not('actual_roi_pct', 'is', null)
      .not('predicted_roi_pct', 'is', null)
      .order('tracked_at', { ascending: false })
      .limit(500)

    if (error) {
      log.warn('[economicConsistencyEngine] roi_prediction_accuracy: query failed', { error: error.message })
      return {
        test: {
          name,
          passed: false,
          score: 0,
          actual: null,
          expected_range: [0, 5],
          details: `Query error: ${error.message}`,
        },
        mae: null,
        rmse: null,
        bias: null,
        sampleCount: 0,
      }
    }

    const rows = (data ?? []) as Array<{ actual_roi_pct: number; predicted_roi_pct: number }>
    if (rows.length === 0) {
      return {
        test: {
          name,
          passed: true,
          score: 75,
          actual: null,
          expected_range: [0, 5],
          details: 'No roi_tracking records with both actual and predicted — insufficient data',
        },
        mae: null,
        rmse: null,
        bias: null,
        sampleCount: 0,
      }
    }

    const pairs = rows.map(r => ({
      actual: Number(r.actual_roi_pct),
      predicted: Number(r.predicted_roi_pct),
    }))

    const mae = computeMAE(pairs)
    const rmse = computeRMSE(pairs)
    const bias = computeBias(pairs)

    let score: number
    let passed: boolean
    if (mae < 2) {
      score = 100; passed = true
    } else if (mae < 5) {
      score = 80; passed = true
    } else if (mae < 10) {
      score = 50; passed = false
    } else {
      score = 0; passed = false
    }

    return {
      test: {
        name,
        passed,
        score,
        actual: mae,
        expected_range: [0, 5],
        details: `MAE=${mae}%, RMSE=${rmse}%, Bias=${bias}% (n=${rows.length})`,
      },
      mae,
      rmse,
      bias,
      sampleCount: rows.length,
    }
  } catch (err) {
    log.error('[economicConsistencyEngine] roi_prediction_accuracy failed', err instanceof Error ? err : undefined)
    return {
      test: {
        name,
        passed: false,
        score: 0,
        actual: null,
        expected_range: [0, 5],
        details: `Exception: ${err instanceof Error ? err.message : String(err)}`,
      },
      mae: null,
      rmse: null,
      bias: null,
      sampleCount: 0,
    }
  }
}

/**
 * Test 3 — liquidity_score_consistency
 * Properties should not swing more than 2 grade levels in 1 day within last 7 days.
 * Grade order: S=4, A=3, B=2, C=1, D=0
 */
async function testLiquidityScoreConsistency(tenantId: string): Promise<EconomicTest> {
  const name = 'liquidity_score_consistency'
  const gradeValue: Record<string, number> = { S: 4, A: 3, B: 2, C: 1, D: 0 }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await (supabaseAdmin as any)
      .from('liquidity_snapshots')
      .select('property_id, liquidity_grade, snapshot_at')
      .eq('tenant_id', tenantId)
      .gte('snapshot_at', sevenDaysAgo)
      .order('property_id', { ascending: true })
      .order('snapshot_at', { ascending: true })
      .limit(2000)

    if (error) {
      log.warn('[economicConsistencyEngine] liquidity_score_consistency: query failed', { error: error.message })
      return {
        name,
        passed: false,
        score: 0,
        actual: null,
        expected_range: [0, 2],
        details: `Query error: ${error.message}`,
      }
    }

    const rows = (data ?? []) as Array<{ property_id: string; liquidity_grade: string; snapshot_at: string }>
    if (rows.length < 2) {
      return {
        name,
        passed: true,
        score: 100,
        actual: 0,
        expected_range: [0, 2],
        details: 'Insufficient snapshot history — assuming stable',
      }
    }

    // Group by property_id
    const byProperty = new Map<string, Array<{ grade: string; at: string }>>()
    for (const row of rows) {
      const arr = byProperty.get(row.property_id) ?? []
      arr.push({ grade: row.liquidity_grade, at: row.snapshot_at })
      byProperty.set(row.property_id, arr)
    }

    let volatileProperties = 0
    let totalChecked = 0

    for (const [, snapshots] of byProperty) {
      if (snapshots.length < 2) continue
      totalChecked++

      // Check for same-day grade swings > 2 levels
      let isVolatile = false
      for (let i = 1; i < snapshots.length; i++) {
        const prev = snapshots[i - 1]
        const curr = snapshots[i]
        const prevDate = prev.at.slice(0, 10)
        const currDate = curr.at.slice(0, 10)
        if (prevDate === currDate) {
          const prevVal = gradeValue[prev.grade] ?? 2
          const currVal = gradeValue[curr.grade] ?? 2
          if (Math.abs(currVal - prevVal) >= 2) {
            isVolatile = true
            break
          }
        }
      }
      if (isVolatile) volatileProperties++
    }

    if (totalChecked === 0) {
      return {
        name,
        passed: true,
        score: 100,
        actual: 0,
        expected_range: [0, 2],
        details: 'No multi-snapshot properties found — assuming stable',
      }
    }

    const volatileRatio = volatileProperties / totalChecked
    const passed = volatileRatio < 0.1   // < 10% volatile properties is acceptable
    const score = passed ? 100 : volatileRatio < 0.25 ? 70 : volatileRatio < 0.5 ? 40 : 10

    return {
      name,
      passed,
      score,
      actual: round4(volatileRatio),
      expected_range: [0, 0.1],
      details: `${volatileProperties}/${totalChecked} properties showed ≥2 grade swing in 1 day (last 7 days)`,
    }
  } catch (err) {
    log.error('[economicConsistencyEngine] liquidity_score_consistency failed', err instanceof Error ? err : undefined)
    return {
      name,
      passed: false,
      score: 0,
      actual: null,
      expected_range: [0, 0.1],
      details: `Exception: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/**
 * Test 4 — counterfactual_label_coverage
 * At least 50% of closed deals in last 90 days should have a counterfactual label.
 */
async function testCounterfactualLabelCoverage(tenantId: string): Promise<EconomicTest> {
  const name = 'counterfactual_label_coverage'
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    // Count closed deals in last 90 days
    const { count: dealsCount, error: dealsErr } = await (supabaseAdmin as any)
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'closed')
      .gte('closed_at', ninetyDaysAgo)

    if (dealsErr) {
      log.warn('[economicConsistencyEngine] counterfactual_label_coverage: deals query failed', { error: dealsErr.message })
      return {
        name,
        passed: false,
        score: 0,
        actual: null,
        expected_range: [50, 100],
        details: `Deals query error: ${dealsErr.message}`,
      }
    }

    const totalDeals = (dealsCount as number) ?? 0
    if (totalDeals === 0) {
      return {
        name,
        passed: true,
        score: 100,
        actual: 100,
        expected_range: [50, 100],
        details: 'No closed deals in last 90 days — coverage vacuously complete',
      }
    }

    // Count counterfactual labels for those deals
    const { count: labelCount, error: labelErr } = await (supabaseAdmin as any)
      .from('counterfactual_labels')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('entity_type', 'deal')
      .gte('created_at', ninetyDaysAgo)

    if (labelErr) {
      log.warn('[economicConsistencyEngine] counterfactual_label_coverage: labels query failed', { error: labelErr.message })
      return {
        name,
        passed: false,
        score: 0,
        actual: null,
        expected_range: [50, 100],
        details: `Labels query error: ${labelErr.message}`,
      }
    }

    const totalLabels = (labelCount as number) ?? 0
    const coveragePct = Math.min(100, round4((totalLabels / totalDeals) * 100))
    const passed = coveragePct >= 50
    const score = Math.round(coveragePct)

    return {
      name,
      passed,
      score,
      actual: coveragePct,
      expected_range: [50, 100],
      details: `${totalLabels} counterfactual labels for ${totalDeals} closed deals (last 90d) = ${coveragePct}% coverage`,
    }
  } catch (err) {
    log.error('[economicConsistencyEngine] counterfactual_label_coverage failed', err instanceof Error ? err : undefined)
    return {
      name,
      passed: false,
      score: 0,
      actual: null,
      expected_range: [50, 100],
      details: `Exception: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/**
 * Test 5 — market_calibration_freshness
 * market_calibration_runs should have an entry within last 14 days per zone.
 * Score: 100 if all zones calibrated, 70 if some, 30 if none.
 */
async function testMarketCalibrationFreshness(tenantId: string): Promise<EconomicTest> {
  const name = 'market_calibration_freshness'
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

    // Get all distinct zones that have ever been calibrated for this tenant
    const { data: allZones, error: zonesErr } = await (supabaseAdmin as any)
      .from('market_calibration_runs')
      .select('zone')
      .eq('tenant_id', tenantId)
      .limit(1000)

    if (zonesErr) {
      log.warn('[economicConsistencyEngine] market_calibration_freshness: zones query failed', { error: zonesErr.message })
      return {
        name,
        passed: false,
        score: 0,
        actual: null,
        expected_range: [70, 100],
        details: `Query error: ${zonesErr.message}`,
      }
    }

    const zoneRows = (allZones ?? []) as Array<{ zone: string }>
    const allDistinctZones = [...new Set(zoneRows.map(r => r.zone))]

    if (allDistinctZones.length === 0) {
      return {
        name,
        passed: false,
        score: 30,
        actual: 0,
        expected_range: [70, 100],
        details: 'No market_calibration_runs found for this tenant',
      }
    }

    // Get zones calibrated in last 14 days
    const { data: freshRows, error: freshErr } = await (supabaseAdmin as any)
      .from('market_calibration_runs')
      .select('zone')
      .eq('tenant_id', tenantId)
      .gte('calibrated_at', fourteenDaysAgo)
      .limit(1000)

    if (freshErr) {
      log.warn('[economicConsistencyEngine] market_calibration_freshness: fresh query failed', { error: freshErr.message })
      return {
        name,
        passed: false,
        score: 0,
        actual: null,
        expected_range: [70, 100],
        details: `Fresh query error: ${freshErr.message}`,
      }
    }

    const freshZones = new Set(((freshRows ?? []) as Array<{ zone: string }>).map(r => r.zone))
    const calibratedCount = allDistinctZones.filter(z => freshZones.has(z)).length
    const totalZones = allDistinctZones.length
    const coverageRatio = calibratedCount / totalZones
    const passed = coverageRatio >= 0.8

    let score: number
    if (coverageRatio >= 0.8) score = 100
    else if (coverageRatio > 0) score = 70
    else score = 30

    return {
      name,
      passed,
      score,
      actual: round4(coverageRatio * 100),
      expected_range: [80, 100],
      details: `${calibratedCount}/${totalZones} zones calibrated in last 14 days (${(coverageRatio * 100).toFixed(1)}%)`,
    }
  } catch (err) {
    log.error('[economicConsistencyEngine] market_calibration_freshness failed', err instanceof Error ? err : undefined)
    return {
      name,
      passed: false,
      score: 0,
      actual: null,
      expected_range: [80, 100],
      details: `Exception: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ─── Severity mapping ──────────────────────────────────────────────────────────

function scoreToSeverity(score: number): EconomicDriftReport['drift_severity'] {
  if (score >= 85) return 'none'
  if (score >= 70) return 'low'
  if (score >= 55) return 'medium'
  if (score >= 35) return 'high'
  return 'critical'
}

// ─── runEconomicConsistencyTests ──────────────────────────────────────────────

export async function runEconomicConsistencyTests(tenantId: string): Promise<EconomicDriftReport> {
  const testedAt = new Date().toISOString()
  log.info('[economicConsistencyEngine] runEconomicConsistencyTests started', { tenant_id: tenantId })

  // Run tests in parallel where possible
  const [
    t1,
    t2Result,
    t3,
    t4,
    t5,
  ] = await Promise.all([
    testScoringDecisionCoherence(tenantId),
    testROIPredictionAccuracy(tenantId),
    testLiquidityScoreConsistency(tenantId),
    testCounterfactualLabelCoverage(tenantId),
    testMarketCalibrationFreshness(tenantId),
  ])

  const { test: t2, mae, rmse, bias, sampleCount } = t2Result
  const tests: EconomicTest[] = [t1, t2, t3, t4, t5]

  // Overall score: average of all test scores
  const overall_score = round4(tests.reduce((s, t) => s + t.score, 0) / tests.length)

  // profit_model_accuracy_score is the ROI accuracy test score
  const profit_model_accuracy_score = t2.score

  const drift_severity = scoreToSeverity(overall_score)

  const report: EconomicDriftReport = {
    id: randomUUID(),
    tenant_id: tenantId,
    overall_score,
    profit_model_accuracy_score,
    mae,
    rmse,
    prediction_bias: bias,
    tests,
    economic_drift_detected: drift_severity !== 'none',
    drift_severity,
    sample_count: sampleCount,
    tested_at: testedAt,
  }

  log.info('[economicConsistencyEngine] runEconomicConsistencyTests completed', {
    tenant_id: tenantId,
    overall_score,
    drift_severity,
    mae,
  })

  return report
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export async function persistEconomicReport(report: EconomicDriftReport): Promise<void> {
  try {
    const { error } = await (supabaseAdmin as any)
      .from('validation_results')
      .insert({
        id: report.id,
        tenant_id: report.tenant_id,
        layer: 'economic_consistency',
        overall_score: report.overall_score,
        drift_detected: report.economic_drift_detected,
        drift_severity: report.drift_severity,
        payload: report,
        created_at: report.tested_at,
      })

    if (error) {
      log.warn('[economicConsistencyEngine] persistEconomicReport failed', {
        tenant_id: report.tenant_id,
        error: error.message,
      })
    }
  } catch (err) {
    log.warn('[economicConsistencyEngine] persistEconomicReport exception', {
      tenant_id: report.tenant_id,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export async function getLatestEconomicReport(tenantId: string): Promise<EconomicDriftReport | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('validation_results')
      .select('payload')
      .eq('tenant_id', tenantId)
      .eq('layer', 'economic_consistency')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      log.warn('[economicConsistencyEngine] getLatestEconomicReport failed', {
        tenant_id: tenantId,
        error: error.message,
      })
      return null
    }

    if (!data?.payload) return null
    return data.payload as EconomicDriftReport
  } catch (err) {
    log.warn('[economicConsistencyEngine] getLatestEconomicReport exception', {
      tenant_id: tenantId,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
