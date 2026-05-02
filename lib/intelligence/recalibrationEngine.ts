// =============================================================================
// Agency Group — Recalibration Engine
// lib/intelligence/recalibrationEngine.ts
//
// Phase 2: Adaptive Learning / Calibration Engine
//
// Extends lib/scoring/calibrationEngine.ts with:
//   - Persistence of recommendations to calibration_recommendations table
//   - Admin apply/dismiss workflow
//   - Drift-triggered recalibration detection
//   - Weekly recompute scheduling support
//
// WHAT THIS IS NOT:
//   This engine NEVER auto-modifies scoring thresholds. It produces
//   recommendations that must be reviewed and applied by an authorized admin.
//
// PURE FUNCTIONS:
//   shouldTriggerRecalibration, computeRecalibrationUrgency, rankRecommendations
//
// DB FUNCTIONS:
//   persistCalibrationRecommendations, getActiveRecommendations,
//   applyRecommendation, dismissRecommendation, getDeferredRecommendations
// =============================================================================

import { supabaseAdmin }                    from '@/lib/supabase'
import { computeCalibrationReport }         from '@/lib/scoring/calibrationEngine'
import type {
  CalibrationReport,
  CalibrationRecommendation,
  RecommendationPriority,
} from '@/lib/scoring/calibrationEngine'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecalibrationStatus = 'pending' | 'applied' | 'dismissed' | 'deferred'

export interface CalibrationRecommendationRecord {
  id:           string
  report_date:  string
  priority:     RecommendationPriority
  dimension:    string
  observation:  string
  suggestion:   string
  evidence?:    string | null
  status:       RecalibrationStatus
  reviewed_by?: string | null
  reviewed_at?: string | null
  notes?:       string | null
  created_at:   string
}

export interface RecalibrationTrigger {
  triggered:    boolean
  reason:       string | null
  urgency:      'critical' | 'high' | 'normal' | 'none'
  critical_count: number
  high_count:   number
}

// ---------------------------------------------------------------------------
// PURE: Determine if recalibration should be triggered from a report
// ---------------------------------------------------------------------------

export function shouldTriggerRecalibration(
  report: CalibrationReport,
  criticalThreshold = 1,
  highThreshold     = 2,
): RecalibrationTrigger {
  if (!report.data_quality.has_enough_data) {
    return {
      triggered:      false,
      reason:         'Insufficient data for calibration',
      urgency:        'none',
      critical_count: 0,
      high_count:     0,
    }
  }

  const criticals = report.recommendations.filter(r => r.priority === 'CRITICAL').length
  const highs     = report.recommendations.filter(r => r.priority === 'HIGH').length

  if (criticals >= criticalThreshold) {
    return {
      triggered:      true,
      reason:         `${criticals} CRITICAL recommendation(s) detected`,
      urgency:        'critical',
      critical_count: criticals,
      high_count:     highs,
    }
  }

  if (highs >= highThreshold) {
    return {
      triggered:      true,
      reason:         `${highs} HIGH recommendation(s) detected`,
      urgency:        'high',
      critical_count: criticals,
      high_count:     highs,
    }
  }

  return {
    triggered:      criticals > 0 || highs > 0,
    reason:         criticals + highs > 0
      ? `${criticals + highs} recommendation(s) below trigger threshold`
      : null,
    urgency:        'normal',
    critical_count: criticals,
    high_count:     highs,
  }
}

// ---------------------------------------------------------------------------
// PURE: Compute urgency score for a set of recommendations (0-100)
// ---------------------------------------------------------------------------

export function computeRecalibrationUrgency(recs: CalibrationRecommendation[]): number {
  const weights: Record<RecommendationPriority, number> = {
    CRITICAL: 40,
    HIGH:     20,
    MEDIUM:    8,
    LOW:       2,
  }
  const raw   = recs.reduce((s, r) => s + (weights[r.priority] ?? 0), 0)
  return Math.min(100, raw)
}

// ---------------------------------------------------------------------------
// PURE: Rank recommendations by priority order
// ---------------------------------------------------------------------------

export function rankRecommendations(
  recs: CalibrationRecommendation[],
): CalibrationRecommendation[] {
  const order: Record<RecommendationPriority, number> = {
    CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
  }
  return [...recs].sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9))
}

// ---------------------------------------------------------------------------
// DB: Persist recommendations from a calibration report
// Idempotent — UNIQUE(report_date, dimension, priority) prevents duplication
// ---------------------------------------------------------------------------

export async function persistCalibrationRecommendations(
  report:     CalibrationReport,
  reportDate: string = new Date().toISOString().split('T')[0],
): Promise<number> {
  if (report.recommendations.length === 0) return 0

  const rows = report.recommendations.map(r => ({
    report_date:  reportDate,
    priority:     r.priority,
    dimension:    r.dimension,
    observation:  r.observation,
    suggestion:   r.suggestion,
    evidence:     r.evidence ?? null,
    status:       'pending',
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('calibration_recommendations')
    .upsert(rows, { onConflict: 'report_date, dimension, priority', ignoreDuplicates: true })

  if (error) throw new Error(`persistCalibrationRecommendations: ${error.message}`)
  return rows.length
}

// ---------------------------------------------------------------------------
// DB: Fetch active (pending) recommendations
// ---------------------------------------------------------------------------

export async function getActiveRecommendations(): Promise<CalibrationRecommendationRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('calibration_recommendations')
    .select('*')
    .eq('status', 'pending')
    .order('report_date', { ascending: false })
    .order('priority', { ascending: true })
    .limit(50)

  if (error) throw new Error(`getActiveRecommendations: ${error.message}`)
  return (data ?? []) as CalibrationRecommendationRecord[]
}

// ---------------------------------------------------------------------------
// DB: Apply a recommendation (mark as applied)
// ---------------------------------------------------------------------------

export async function applyRecommendation(
  id:        string,
  appliedBy: string,
  notes?:    string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('calibration_recommendations')
    .update({
      status:      'applied',
      reviewed_by: appliedBy,
      reviewed_at: new Date().toISOString(),
      notes:       notes ?? null,
    })
    .eq('id', id)
    .eq('status', 'pending')  // optimistic lock — can only apply pending

  if (error) throw new Error(`applyRecommendation: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Dismiss a recommendation
// ---------------------------------------------------------------------------

export async function dismissRecommendation(
  id:          string,
  dismissedBy: string,
  reason?:     string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('calibration_recommendations')
    .update({
      status:      'dismissed',
      reviewed_by: dismissedBy,
      reviewed_at: new Date().toISOString(),
      notes:       reason ?? null,
    })
    .eq('id', id)
    .in('status', ['pending', 'deferred'])

  if (error) throw new Error(`dismissRecommendation: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Defer a recommendation to next review cycle
// ---------------------------------------------------------------------------

export async function deferRecommendation(
  id:         string,
  deferredBy: string,
  notes?:     string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('calibration_recommendations')
    .update({
      status:      'deferred',
      reviewed_by: deferredBy,
      reviewed_at: new Date().toISOString(),
      notes:       notes ?? null,
    })
    .eq('id', id)
    .eq('status', 'pending')

  if (error) throw new Error(`deferRecommendation: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Weekly recompute — run report + persist recommendations
// Returns summary of what was found and persisted
// ---------------------------------------------------------------------------

export async function runWeeklyCalibration(): Promise<{
  report:       CalibrationReport
  trigger:      RecalibrationTrigger
  persisted:    number
  urgency_score: number
}> {
  const report       = await computeCalibrationReport()
  const trigger      = shouldTriggerRecalibration(report)
  const urgencyScore = computeRecalibrationUrgency(report.recommendations)
  const persisted    = await persistCalibrationRecommendations(report)

  return { report, trigger, persisted, urgency_score: urgencyScore }
}

// Re-export types from calibrationEngine for convenience
export type { CalibrationReport, CalibrationRecommendation, RecommendationPriority }
