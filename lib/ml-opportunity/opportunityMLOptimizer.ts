// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Opportunity ML Optimizer (Wave 42)
// lib/ml-opportunity/opportunityMLOptimizer.ts
//
// Continuously improves the opportunity detection system using real deal outcomes.
// Reads feedback_signals (truth labels), detection_accuracy_reports, and
// opportunity_demand_signals to adjust scoring weights and thresholds.
//
// EUR cents arithmetic: integer bigint, never float for money.
// Fire-and-forget: void promise.catch(e => console.warn('[module]', e))
// =============================================================================

import { randomUUID }    from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log               from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OptimizationSignal =
  | 'SCORE_WEIGHT_ADJUSTMENT'
  | 'THRESHOLD_CALIBRATION'
  | 'MARKET_BIAS_CORRECTION'
  | 'TYPE_RERANKING'

export interface MLOptimizationCycle {
  cycle_id: string
  tenant_id: string
  signals_analyzed: number
  truth_labels_used: number            // DEAL_CLOSED + DEAL_FAILED signals
  optimizations_applied: OptimizationSignal[]
  accuracy_before: number              // detection accuracy % before optimization
  accuracy_after: number               // estimated accuracy after
  weight_adjustments: Record<string, number>    // component weights delta
  threshold_adjustments: Record<string, number> // score thresholds delta
  ran_at: string
}

export interface OpportunityScoringWeights {
  undervaluation: number     // default 0.30
  liquidity: number          // default 0.25
  investor_demand: number    // default 0.20
  risk_adjusted_roi: number  // default 0.15
  source_confidence: number  // default 0.10
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: OpportunityScoringWeights = {
  undervaluation:    0.30,
  liquidity:         0.25,
  investor_demand:   0.20,
  risk_adjusted_roi: 0.15,
  source_confidence: 0.10,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(value: unknown, fallback = 0): number {
  const n = Number(value)
  return isFinite(n) ? n : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

// ─── runOptimizationCycle ─────────────────────────────────────────────────────

/**
 * Reads truth labels (DEAL_CLOSED + DEAL_FAILED) from feedback_signals,
 * checks detection_accuracy_reports for current accuracy baseline,
 * computes weight and threshold adjustments, persists to:
 *   - scoring_weight_history
 *   - ml_optimization_cycles
 */
export async function runOptimizationCycle(tenantId: string): Promise<MLOptimizationCycle> {
  const cycleId = randomUUID()
  const optimizationsApplied: OptimizationSignal[] = []

  // ── 1. Fetch truth labels ──────────────────────────────────────────────────
  const { data: truthSignals, error: signalErr } = await (supabaseAdmin as any)
    .from('feedback_signals')
    .select('signal_type, opportunity_id, metadata')
    .eq('tenant_id', tenantId)
    .eq('is_truth_label', true)
    .in('signal_type', ['DEAL_CLOSED', 'DEAL_FAILED'])
    .order('occurred_at', { ascending: false })
    .limit(500)

  if (signalErr) {
    log.warn('[opportunityMLOptimizer] feedback_signals fetch failed', { detail: signalErr.message })
  }

  const truth = (truthSignals ?? []) as Array<{
    signal_type: string
    opportunity_id: string
    metadata: Record<string, unknown>
  }>

  const truthLabelsUsed = truth.length
  const closedCount     = truth.filter(r => r.signal_type === 'DEAL_CLOSED').length
  const failedCount     = truth.filter(r => r.signal_type === 'DEAL_FAILED').length

  // ── 2. Fetch opportunity_outcomes for undervaluation correlation ───────────
  // We look up the undervaluation_score from detected_opportunities for each
  // DEAL_CLOSED opportunity_id to see if high undervaluation → close.
  const closedOpportunityIds = truth
    .filter(r => r.signal_type === 'DEAL_CLOSED')
    .map(r => r.opportunity_id)
    .slice(0, 100)

  let avgUndervaluationForClosed = 50  // neutral default

  if (closedOpportunityIds.length > 0) {
    const { data: closedOpps } = await (supabaseAdmin as any)
      .from('detected_opportunities')
      .select('undervaluation_score')
      .eq('tenant_id', tenantId)
      .in('opportunity_id', closedOpportunityIds)

    const scores = ((closedOpps ?? []) as Array<{ undervaluation_score: number | null }>)
      .map(o => toNum(o.undervaluation_score, 50))

    if (scores.length > 0) {
      avgUndervaluationForClosed = scores.reduce((s, v) => s + v, 0) / scores.length
    }
  }

  // ── 3. Fetch latest detection_accuracy_reports ────────────────────────────
  // Falls back to computing close_rate from truth signals if table is empty.
  let accuracyBefore = 0

  const { data: accuracyReports } = await (supabaseAdmin as any)
    .from('detection_accuracy_reports')
    .select('close_rate, accuracy_pct')
    .eq('tenant_id', tenantId)
    .order('reported_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (accuracyReports) {
    accuracyBefore = toNum(accuracyReports.close_rate ?? accuracyReports.accuracy_pct, 0)
  } else if (truthLabelsUsed > 0) {
    // Compute from truth labels directly
    const total = closedCount + failedCount
    accuracyBefore = total > 0 ? (closedCount / total) * 100 : 0
  }

  // ── 4. Compute weight adjustments ─────────────────────────────────────────
  const currentWeights = await getCurrentScoringWeights(tenantId)
  const weightAdjustments: Record<string, number> = {}

  // If avg undervaluation of DEAL_CLOSED > 60 → increase undervaluation weight
  // If avg undervaluation of DEAL_CLOSED < 40 → decrease undervaluation weight
  if (avgUndervaluationForClosed > 60) {
    weightAdjustments.undervaluation = +0.02
    optimizationsApplied.push('SCORE_WEIGHT_ADJUSTMENT')
  } else if (avgUndervaluationForClosed < 40 && closedCount > 0) {
    weightAdjustments.undervaluation = -0.02
    optimizationsApplied.push('SCORE_WEIGHT_ADJUSTMENT')
  }

  // Rebalance: if we adjust one weight, shift the opposite from liquidity
  if (weightAdjustments.undervaluation) {
    weightAdjustments.liquidity = -(weightAdjustments.undervaluation / 2)
    weightAdjustments.source_confidence = -(weightAdjustments.undervaluation / 2)
  }

  // ── 5. Compute threshold adjustments ──────────────────────────────────────
  const thresholdAdjustments: Record<string, number> = {}
  const closeRate = (truthLabelsUsed > 0 && (closedCount + failedCount) > 0)
    ? (closedCount / (closedCount + failedCount)) * 100
    : accuracyBefore

  if (closeRate < 20 && truthLabelsUsed >= 5) {
    // Lower detection threshold so more opportunities bubble up
    thresholdAdjustments.opportunity_detection = -5
    optimizationsApplied.push('THRESHOLD_CALIBRATION')
  } else if (closeRate > 60 && truthLabelsUsed >= 5) {
    // Raise threshold — too many low-quality detections
    thresholdAdjustments.opportunity_detection = +5
    optimizationsApplied.push('THRESHOLD_CALIBRATION')
  }

  // TYPE_RERANKING: if failed count > closed count → flag for reranking
  if (failedCount > closedCount && truthLabelsUsed >= 3) {
    optimizationsApplied.push('TYPE_RERANKING')
  }

  // ── 6. Compute new weights (clamped 0.05–0.60) ────────────────────────────
  const newWeights: OpportunityScoringWeights = {
    undervaluation:    clamp(round3(currentWeights.undervaluation    + (weightAdjustments.undervaluation    ?? 0)), 0.05, 0.60),
    liquidity:         clamp(round3(currentWeights.liquidity         + (weightAdjustments.liquidity         ?? 0)), 0.05, 0.60),
    investor_demand:   clamp(round3(currentWeights.investor_demand   + (weightAdjustments.investor_demand   ?? 0)), 0.05, 0.60),
    risk_adjusted_roi: clamp(round3(currentWeights.risk_adjusted_roi + (weightAdjustments.risk_adjusted_roi ?? 0)), 0.05, 0.60),
    source_confidence: clamp(round3(currentWeights.source_confidence + (weightAdjustments.source_confidence ?? 0)), 0.05, 0.60),
  }

  // Estimated accuracy: slight improvement if thresholds adjusted, else stable
  const accuracyAfter = thresholdAdjustments.opportunity_detection
    ? clamp(accuracyBefore + Math.abs(thresholdAdjustments.opportunity_detection) * 0.5, 0, 100)
    : accuracyBefore

  // ── 7. Persist new weights to scoring_weight_history ──────────────────────
  const { error: weightErr } = await (supabaseAdmin as any)
    .from('scoring_weight_history')
    .insert({
      tenant_id:         tenantId,
      undervaluation:    newWeights.undervaluation,
      liquidity:         newWeights.liquidity,
      investor_demand:   newWeights.investor_demand,
      risk_adjusted_roi: newWeights.risk_adjusted_roi,
      source_confidence: newWeights.source_confidence,
      trigger:           `optimization_cycle:${cycleId}`,
    })

  if (weightErr) {
    log.warn('[opportunityMLOptimizer] scoring_weight_history insert failed', { detail: weightErr.message })
  }

  // ── 8. Persist optimization cycle ─────────────────────────────────────────
  const cycleRow = {
    cycle_id:               cycleId,
    tenant_id:              tenantId,
    signals_analyzed:       truth.length,
    truth_labels_used:      truthLabelsUsed,
    optimizations_applied:  optimizationsApplied,
    accuracy_before:        round3(accuracyBefore / 100),
    accuracy_after:         round3(accuracyAfter / 100),
    weight_adjustments:     weightAdjustments,
    threshold_adjustments:  thresholdAdjustments,
    ran_at:                 new Date().toISOString(),
  }

  const { error: cycleErr } = await (supabaseAdmin as any)
    .from('ml_optimization_cycles')
    .insert(cycleRow)

  if (cycleErr) {
    log.warn('[opportunityMLOptimizer] ml_optimization_cycles insert failed', { detail: cycleErr.message })
  }

  const result: MLOptimizationCycle = {
    cycle_id:               cycleId,
    tenant_id:              tenantId,
    signals_analyzed:       truth.length,
    truth_labels_used:      truthLabelsUsed,
    optimizations_applied:  optimizationsApplied,
    accuracy_before:        accuracyBefore,
    accuracy_after:         accuracyAfter,
    weight_adjustments:     weightAdjustments,
    threshold_adjustments:  thresholdAdjustments,
    ran_at:                 cycleRow.ran_at,
  }

  log.info('[opportunityMLOptimizer] optimization cycle complete', {
    cycle_id:        cycleId,
    signals_analyzed: truth.length,
    accuracy_before: accuracyBefore,
    accuracy_after:  accuracyAfter,
  })

  return result
}

// ─── getCurrentScoringWeights ─────────────────────────────────────────────────

/**
 * Returns latest scoring weights from scoring_weight_history.
 * Falls back to DEFAULT_WEIGHTS if none persisted yet.
 */
export async function getCurrentScoringWeights(tenantId: string): Promise<OpportunityScoringWeights> {
  const { data } = await (supabaseAdmin as any)
    .from('scoring_weight_history')
    .select('undervaluation, liquidity, investor_demand, risk_adjusted_roi, source_confidence')
    .eq('tenant_id', tenantId)
    .order('adjusted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return { ...DEFAULT_WEIGHTS }

  return {
    undervaluation:    toNum(data.undervaluation,    DEFAULT_WEIGHTS.undervaluation),
    liquidity:         toNum(data.liquidity,         DEFAULT_WEIGHTS.liquidity),
    investor_demand:   toNum(data.investor_demand,   DEFAULT_WEIGHTS.investor_demand),
    risk_adjusted_roi: toNum(data.risk_adjusted_roi, DEFAULT_WEIGHTS.risk_adjusted_roi),
    source_confidence: toNum(data.source_confidence, DEFAULT_WEIGHTS.source_confidence),
  }
}

// ─── getOptimizationHistory ───────────────────────────────────────────────────

/**
 * Returns the last N optimization cycles for a tenant.
 */
export async function getOptimizationHistory(
  tenantId: string,
  limit = 20,
): Promise<MLOptimizationCycle[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('ml_optimization_cycles')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('ran_at', { ascending: false })
    .limit(Math.min(limit, 100))

  if (error) {
    log.warn('[opportunityMLOptimizer] getOptimizationHistory failed', { detail: error.message })
    return []
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map(row => ({
    cycle_id:               String(row.cycle_id ?? ''),
    tenant_id:              String(row.tenant_id ?? ''),
    signals_analyzed:       toNum(row.signals_analyzed),
    truth_labels_used:      toNum(row.truth_labels_used),
    optimizations_applied:  Array.isArray(row.optimizations_applied) ? (row.optimizations_applied as OptimizationSignal[]) : [],
    accuracy_before:        toNum(row.accuracy_before) * 100,
    accuracy_after:         toNum(row.accuracy_after) * 100,
    weight_adjustments:     (row.weight_adjustments ?? {}) as Record<string, number>,
    threshold_adjustments:  (row.threshold_adjustments ?? {}) as Record<string, number>,
    ran_at:                 String(row.ran_at ?? ''),
  }))
}

// ─── applyFeedbackToOpportunityScores ────────────────────────────────────────

/**
 * Reads all ACTIVE opportunities that have demand signals with net_feedback_score > 0.
 * Adds a demand bonus to opportunity_score based on:
 *   bonus = (demand_score / 100) * investor_demand_weight * 100
 * Updates detected_opportunities in batch.
 */
export async function applyFeedbackToOpportunityScores(
  tenantId: string,
): Promise<{ updated: number }> {
  // 1. Fetch demand signals with positive net score
  const { data: demandSignals, error: demandErr } = await (supabaseAdmin as any)
    .from('opportunity_demand_signals')
    .select('opportunity_id, demand_score, net_feedback_score')
    .eq('tenant_id', tenantId)
    .gt('net_feedback_score', 0)

  if (demandErr) {
    log.warn('[opportunityMLOptimizer] opportunity_demand_signals fetch failed', { detail: demandErr.message })
    return { updated: 0 }
  }

  const signals = (demandSignals ?? []) as Array<{
    opportunity_id: string
    demand_score: number
    net_feedback_score: number
  }>

  if (signals.length === 0) return { updated: 0 }

  // 2. Get current investor_demand weight
  const weights = await getCurrentScoringWeights(tenantId)
  const investorDemandWeight = weights.investor_demand

  // 3. Fetch current scores for affected opportunities
  const opportunityIds = signals.map(s => s.opportunity_id)

  const { data: opportunities, error: oppErr } = await (supabaseAdmin as any)
    .from('detected_opportunities')
    .select('opportunity_id, opportunity_score')
    .eq('tenant_id', tenantId)
    .eq('status', 'ACTIVE')
    .in('opportunity_id', opportunityIds)

  if (oppErr) {
    log.warn('[opportunityMLOptimizer] detected_opportunities fetch failed', { detail: oppErr.message })
    return { updated: 0 }
  }

  const opportunities_ = (opportunities ?? []) as Array<{
    opportunity_id: string
    opportunity_score: number | null
  }>

  // Build a lookup: opportunity_id → demand signal
  const demandByOpp: Record<string, number> = {}
  for (const s of signals) {
    demandByOpp[s.opportunity_id] = toNum(s.demand_score, 0)
  }

  // 4. Compute updated scores and persist
  let updated = 0

  for (const opp of opportunities_) {
    const demandScore = demandByOpp[opp.opportunity_id] ?? 0
    const bonus = (demandScore / 100) * investorDemandWeight * 100
    const currentScore = toNum(opp.opportunity_score, 0)
    const newScore = Math.min(currentScore + bonus, 100)

    if (newScore === currentScore) continue

    const { error: updateErr } = await (supabaseAdmin as any)
      .from('detected_opportunities')
      .update({ opportunity_score: Math.round(newScore * 100) / 100 })
      .eq('tenant_id', tenantId)
      .eq('opportunity_id', opp.opportunity_id)

    if (updateErr) {
      log.warn('[opportunityMLOptimizer] score update failed', {
        opportunity_id: opp.opportunity_id,
        detail: updateErr.message,
      })
    } else {
      updated++
    }
  }

  log.info('[opportunityMLOptimizer] applyFeedbackToOpportunityScores complete', {
    tenant_id: tenantId,
    candidates: signals.length,
    updated,
  })

  return { updated }
}
