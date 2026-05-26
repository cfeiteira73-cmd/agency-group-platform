// =============================================================================
// Agency Group — Opportunity Performance Tracker
// lib/feedback/opportunityPerformanceTracker.ts
//
// Tracks performance of the opportunity detection system: how accurate was
// scoring vs reality? Compares predicted scores/ROI to actual outcomes.
//
// EUR cents arithmetic: integer bigint, never float for money.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OpportunityOutcome {
  outcome_id: string
  tenant_id: string
  opportunity_id: string
  asset_id: string
  opportunity_type: string

  // Predicted
  predicted_opportunity_score: number
  predicted_roi_pct: number
  predicted_days_to_close: number | null

  // Actual
  actual_outcome: 'CLOSED' | 'FAILED' | 'EXPIRED' | 'ONGOING'
  actual_price_eur_cents: number | null
  actual_roi_pct: number | null
  actual_days_to_close: number | null

  // Accuracy
  score_accuracy: number | null            // how close predicted score was to reality
  roi_prediction_error_pct: number | null

  recorded_at: string
}

export interface DetectionAccuracyReport {
  report_id: string
  tenant_id: string
  period_start: string
  period_end: string
  total_opportunities: number
  closed: number
  failed: number
  expired: number
  close_rate: number
  avg_predicted_score: number
  avg_actual_roi_pct: number | null
  score_to_close_correlation: number | null  // simplified: closed_avg_score / all_avg_score
  best_performing_type: string | null
  worst_performing_type: string | null
  generated_at: string
}

// ---------------------------------------------------------------------------
// recordOpportunityOutcome
// ---------------------------------------------------------------------------

/**
 * Reads opportunity data, creates outcome record, persists to opportunity_outcomes.
 */
export async function recordOpportunityOutcome(
  opportunityId: string,
  outcome: OpportunityOutcome['actual_outcome'],
  tenantId: string,
  actualPriceEurCents?: number,
  actualRoiPct?: number,
): Promise<OpportunityOutcome> {
  // Fetch predicted data from raw_opportunity_stream
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: oppData } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .select('id, asking_price_eur_cents, opportunity_score, property_type')
    .eq('tenant_id', tenantId)
    .eq('id', opportunityId)
    .maybeSingle()

  const predictedScore = (oppData?.opportunity_score as number | null) ?? 50
  const opportunityType = (oppData?.property_type as string | null) ?? 'UNKNOWN'
  const askingCents     = (oppData?.asking_price_eur_cents as number | null) ?? 0

  // Predicted ROI: use asking price vs AVM or default 0
  const predictedRoiPct = 0  // no AVM available at this point

  // Actual ROI: if actual price provided, compute vs asking
  let computedActualRoi: number | null = actualRoiPct ?? null
  if (computedActualRoi == null && actualPriceEurCents != null && askingCents > 0) {
    computedActualRoi = ((actualPriceEurCents - askingCents) / askingCents) * 100
  }

  // Score accuracy: 1 - abs(predicted - 100*outcome_binary) / 100
  // Simplified: if CLOSED, actual = 100; else 0
  const outcomeBinary  = outcome === 'CLOSED' ? 100 : 0
  const scoreAccuracy  = 1 - Math.abs(predictedScore - outcomeBinary) / 100

  // ROI prediction error
  const roiPredictionError = computedActualRoi != null
    ? Math.abs(predictedRoiPct - computedActualRoi)
    : null

  const row = {
    tenant_id:                   tenantId,
    opportunity_id:              opportunityId,
    asset_id:                    opportunityId,  // use same id as asset reference
    opportunity_type:            opportunityType,
    predicted_opportunity_score: predictedScore,
    predicted_roi_pct:           predictedRoiPct,
    predicted_days_to_close:     null,
    actual_outcome:              outcome,
    actual_price_eur_cents:      actualPriceEurCents ?? null,
    actual_roi_pct:              computedActualRoi,
    actual_days_to_close:        null,
    score_accuracy:              scoreAccuracy,
    roi_prediction_error_pct:    roiPredictionError,
    recorded_at:                 new Date().toISOString(),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('opportunity_outcomes')
    .insert(row)
    .select()
    .single()

  if (error) {
    log.error('[opportunityPerformanceTracker] recordOpportunityOutcome failed', new Error(error.message), {
      opportunity_id: opportunityId,
    })
    throw new Error(`recordOpportunityOutcome: ${error.message}`)
  }

  return {
    outcome_id:                  data.outcome_id as string,
    tenant_id:                   data.tenant_id as string,
    opportunity_id:              data.opportunity_id as string,
    asset_id:                    data.asset_id as string,
    opportunity_type:            data.opportunity_type as string,
    predicted_opportunity_score: data.predicted_opportunity_score as number,
    predicted_roi_pct:           data.predicted_roi_pct as number,
    predicted_days_to_close:     data.predicted_days_to_close as number | null,
    actual_outcome:              data.actual_outcome as OpportunityOutcome['actual_outcome'],
    actual_price_eur_cents:      data.actual_price_eur_cents as number | null,
    actual_roi_pct:              data.actual_roi_pct as number | null,
    actual_days_to_close:        data.actual_days_to_close as number | null,
    score_accuracy:              data.score_accuracy as number | null,
    roi_prediction_error_pct:    data.roi_prediction_error_pct as number | null,
    recorded_at:                 data.recorded_at as string,
  }
}

// ---------------------------------------------------------------------------
// generateAccuracyReport
// ---------------------------------------------------------------------------

/**
 * Aggregates all outcomes, computes metrics, persists to detection_accuracy_reports.
 */
export async function generateAccuracyReport(
  tenantId: string,
  since?: Date,
): Promise<DetectionAccuracyReport> {
  const now       = new Date()
  const sinceDate = since ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sinceIso  = sinceDate.toISOString()
  const nowIso    = now.toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outcomes, error } = await (supabaseAdmin as any)
    .from('opportunity_outcomes')
    .select(
      'actual_outcome, predicted_opportunity_score, actual_roi_pct, opportunity_type, score_accuracy',
    )
    .eq('tenant_id', tenantId)
    .gte('recorded_at', sinceIso)

  if (error) {
    throw new Error(`generateAccuracyReport: ${error.message}`)
  }

  const rows = (outcomes ?? []) as Array<{
    actual_outcome:              string
    predicted_opportunity_score: number
    actual_roi_pct:              number | null
    opportunity_type:            string
    score_accuracy:              number | null
  }>

  const total      = rows.length
  const closed     = rows.filter(r => r.actual_outcome === 'CLOSED').length
  const failed     = rows.filter(r => r.actual_outcome === 'FAILED').length
  const expired    = rows.filter(r => r.actual_outcome === 'EXPIRED').length
  const close_rate = total > 0 ? closed / total : 0

  const avgPredictedScore = total > 0
    ? rows.reduce((s, r) => s + (r.predicted_opportunity_score ?? 0), 0) / total
    : 0

  const roiRows = rows.filter(r => r.actual_roi_pct != null)
  const avgActualRoi = roiRows.length > 0
    ? roiRows.reduce((s, r) => s + (r.actual_roi_pct ?? 0), 0) / roiRows.length
    : null

  // score_to_close_correlation: closed_avg_score / all_avg_score
  const closedRows       = rows.filter(r => r.actual_outcome === 'CLOSED')
  const closedAvgScore   = closedRows.length > 0
    ? closedRows.reduce((s, r) => s + (r.predicted_opportunity_score ?? 0), 0) / closedRows.length
    : null

  const scoreToCloseCorr = closedAvgScore != null && avgPredictedScore > 0
    ? closedAvgScore / avgPredictedScore
    : null

  // Best/worst by type (most/fewest closes)
  const typeClosed: Record<string, number>   = {}
  const typeTotal:  Record<string, number>   = {}

  for (const r of rows) {
    const t = r.opportunity_type ?? 'UNKNOWN'
    typeTotal[t]  = (typeTotal[t]  ?? 0) + 1
    if (r.actual_outcome === 'CLOSED') {
      typeClosed[t] = (typeClosed[t] ?? 0) + 1
    }
  }

  const typeCloseRates = Object.entries(typeTotal).map(([t, cnt]) => ({
    type:      t,
    closeRate: ((typeClosed[t] ?? 0) / cnt),
    cnt,
  }))

  typeCloseRates.sort((a, b) => b.closeRate - a.closeRate)

  const best_performing_type  = typeCloseRates[0]?.type ?? null
  const worst_performing_type = typeCloseRates[typeCloseRates.length - 1]?.type ?? null

  const reportId = `rpt_${tenantId}_${Date.now()}`

  const reportRow = {
    report_id:                  reportId,
    tenant_id:                  tenantId,
    period_start:               sinceIso,
    period_end:                 nowIso,
    total_opportunities:        total,
    closed,
    failed,
    expired,
    close_rate:                 Math.round(close_rate * 1000) / 1000,
    avg_predicted_score:        Math.round(avgPredictedScore * 100) / 100,
    avg_actual_roi_pct:         avgActualRoi != null ? Math.round(avgActualRoi * 10000) / 10000 : null,
    score_to_close_correlation: scoreToCloseCorr != null ? Math.round(scoreToCloseCorr * 10000) / 10000 : null,
    best_performing_type,
    worst_performing_type,
    generated_at:               nowIso,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: saved, error: saveErr } = await (supabaseAdmin as any)
    .from('detection_accuracy_reports')
    .insert(reportRow)
    .select()
    .single()

  if (saveErr) {
    log.warn('[opportunityPerformanceTracker] generateAccuracyReport persist failed', {
      detail: saveErr.message,
    })
    // Return computed report even if persist fails
    return reportRow as DetectionAccuracyReport
  }

  return saved as DetectionAccuracyReport
}

// ---------------------------------------------------------------------------
// getAccuracyHistory
// ---------------------------------------------------------------------------

/**
 * Returns the last N detection accuracy reports for a tenant.
 */
export async function getAccuracyHistory(
  tenantId: string,
  limit = 10,
): Promise<DetectionAccuracyReport[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('detection_accuracy_reports')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('generated_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`getAccuracyHistory: ${error.message}`)
  }

  return (data ?? []) as DetectionAccuracyReport[]
}
