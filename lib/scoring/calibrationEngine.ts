// =============================================================================
// Agency Group — Scoring Calibration Engine
// lib/scoring/calibrationEngine.ts
//
// Reads realized outcomes from scoring_feedback_events and produces
// RECOMMENDATIONS for scoring adjustments. This engine is read-only —
// it NEVER auto-modifies scoring thresholds. Adjustments must be applied
// manually after review.
//
// METRICS COMPUTED:
//   - Hit rate by grade band (deal_won / total_surfaced)
//   - Meeting rate by grade band (meeting_booked / total_surfaced)
//   - Yield prediction error (realized − predicted)
//   - Grade separation quality (are A+ deals actually better than B?)
//   - Calibration drift (are recent outcomes diverging from historical?)
//
// OUTPUT: CalibrationReport with ranked recommendations
//
// DB FUNCTION — requires Supabase service role.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GradePerformance {
  grade:               string
  total_surfaced:      number
  deals_won:           number
  meetings:            number
  offers:              number
  win_rate_pct:        number | null
  meeting_rate_pct:    number | null
  avg_realized_yield:  number | null
  avg_predicted_yield: number | null
  yield_error:         number | null   // realized - predicted
}

export type RecommendationPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface CalibrationRecommendation {
  priority:     RecommendationPriority
  dimension:    string    // e.g. 'grade_thresholds', 'yield_model', 'confidence_penalty'
  observation:  string    // what the data shows
  suggestion:   string    // specific non-breaking change to consider
  evidence:     string    // supporting numbers
}

export interface CalibrationReport {
  generated_at:          string
  total_feedback_events: number
  grade_performance:     GradePerformance[]
  recommendations:       CalibrationRecommendation[]
  data_quality:          {
    has_enough_data:     boolean   // ≥20 events per grade needed for statistical significance
    min_events_per_grade: number
    grades_with_data:    string[]
  }
  raw_error:             string | null   // set if DB query failed
}

// ---------------------------------------------------------------------------
// Fetch performance from the v_scoring_performance view
// ---------------------------------------------------------------------------

interface ViewRow {
  opportunity_grade:    string | null
  total_surfaced:       number | string
  opened:               number | string
  replied:              number | string
  meetings:             number | string
  offers:               number | string
  deals_won:            number | string
  win_rate_pct:         number | string | null
  meeting_rate_pct:     number | string | null
  avg_realized_yield:   number | string | null
  avg_predicted_yield:  number | string | null
  yield_prediction_error: number | string | null
}

async function fetchGradePerformance(): Promise<{ data: GradePerformance[]; error: string | null }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('v_scoring_performance')
      .select('*')

    if (error) return { data: [], error: error.message }

    const rows = (data ?? []) as ViewRow[]
    const performance: GradePerformance[] = rows.map(r => ({
      grade:               r.opportunity_grade ?? 'unknown',
      total_surfaced:      Number(r.total_surfaced),
      deals_won:           Number(r.deals_won),
      meetings:            Number(r.meetings),
      offers:              Number(r.offers),
      win_rate_pct:        r.win_rate_pct != null ? Number(r.win_rate_pct) : null,
      meeting_rate_pct:    r.meeting_rate_pct != null ? Number(r.meeting_rate_pct) : null,
      avg_realized_yield:  r.avg_realized_yield != null ? Number(r.avg_realized_yield) : null,
      avg_predicted_yield: r.avg_predicted_yield != null ? Number(r.avg_predicted_yield) : null,
      yield_error:         r.yield_prediction_error != null ? Number(r.yield_prediction_error) : null,
    }))

    return { data: performance, error: null }
  } catch (err) {
    return {
      data:  [],
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ---------------------------------------------------------------------------
// Generate recommendations from performance data
// ---------------------------------------------------------------------------

function generateRecommendations(grades: GradePerformance[]): CalibrationRecommendation[] {
  const recs: CalibrationRecommendation[] = []

  const gradeLookup = Object.fromEntries(grades.map(g => [g.grade, g]))
  const aPlus = gradeLookup['A+']
  const a     = gradeLookup['A']
  const b     = gradeLookup['B']
  const c     = gradeLookup['C']
  const d     = gradeLookup['D']

  // 1. Check grade separation: A+ should have meaningfully higher win rate than B
  if (aPlus && b && aPlus.win_rate_pct != null && b.win_rate_pct != null) {
    const gap = aPlus.win_rate_pct - b.win_rate_pct
    if (gap < 10) {
      recs.push({
        priority:    'HIGH',
        dimension:   'grade_thresholds',
        observation: `A+ win rate (${aPlus.win_rate_pct}%) is only ${gap.toFixed(1)}% higher than B (${b.win_rate_pct}%)`,
        suggestion:  'Consider raising the A+ threshold from 85 to 88-90 to tighten the top tier',
        evidence:    `A+ deals=${aPlus.deals_won}/${aPlus.total_surfaced}, B deals=${b.deals_won}/${b.total_surfaced}`,
      })
    }
    if (gap > 30) {
      recs.push({
        priority:    'MEDIUM',
        dimension:   'grade_thresholds',
        observation: `A+ win rate (${aPlus.win_rate_pct}%) is ${gap.toFixed(1)}% higher than B (${b.win_rate_pct}%) — strong separation`,
        suggestion:  'Grade thresholds appear well-calibrated for conversion; no change needed',
        evidence:    `A+ deals=${aPlus.deals_won}/${aPlus.total_surfaced}, B deals=${b.deals_won}/${b.total_surfaced}`,
      })
    }
  }

  // 2. Check yield prediction accuracy
  const highGrades = [aPlus, a].filter(Boolean) as GradePerformance[]
  for (const g of highGrades) {
    if (g.yield_error != null && Math.abs(g.yield_error) > 1.5) {
      const direction = g.yield_error > 0 ? 'overpredicting' : 'underpredicting'
      const magnitude = Math.abs(g.yield_error).toFixed(2)
      recs.push({
        priority:    'HIGH',
        dimension:   'yield_model',
        observation: `Grade ${g.grade}: model is ${direction} yield by ${magnitude}% on average`,
        suggestion:  g.yield_error > 0
          ? 'Consider applying a higher vacancy factor or increasing expense ratio in yield computation'
          : 'Zone rental data (renda_m2) may be understating achievable rents — check against recent AL data',
        evidence:    `avg_predicted=${g.avg_predicted_yield?.toFixed(2)}%, avg_realized=${g.avg_realized_yield?.toFixed(2)}%`,
      })
    }
  }

  // 3. Check D-grade false positives (should never generate priority_items)
  if (d && d.total_surfaced > 0) {
    recs.push({
      priority:    'MEDIUM',
      dimension:   'grade_thresholds',
      observation: `${d.total_surfaced} D-grade properties were surfaced to investors`,
      suggestion:  'Ensure investor alert cron uses min_score filter ≥40 to avoid surfacing D-grade properties',
      evidence:    `D grade deals_won=${d.deals_won}, win_rate=${d.win_rate_pct ?? 0}%`,
    })
  }

  // 4. Check if A-grade meeting rate is reasonable (should be >30%)
  if (a && a.meeting_rate_pct != null && a.meeting_rate_pct < 20) {
    recs.push({
      priority:    'HIGH',
      dimension:   'investor_matching',
      observation: `A-grade meeting rate is only ${a.meeting_rate_pct}% — lower than expected for quality deals`,
      suggestion:  'Review investor preference matching — A-grade properties may not align with surfaced investor profiles',
      evidence:    `A grade meetings=${a.meetings}/${a.total_surfaced}`,
    })
  }

  // 5. Insufficient data warning
  const minEvents = Math.min(...grades.map(g => g.total_surfaced))
  if (minEvents < 10) {
    recs.push({
      priority:    'LOW',
      dimension:   'data_volume',
      observation: `Minimum ${minEvents} events per grade — insufficient for statistical confidence`,
      suggestion:  'Continue operating; revisit calibration recommendations once ≥20 events per grade band are available',
      evidence:    grades.map(g => `${g.grade}=${g.total_surfaced}`).join(', '),
    })
  }

  return recs.sort((a, b) => {
    const order: Record<RecommendationPriority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
    return order[a.priority] - order[b.priority]
  })
}

// ---------------------------------------------------------------------------
// Main export: computeCalibrationReport
// ---------------------------------------------------------------------------

export async function computeCalibrationReport(): Promise<CalibrationReport> {
  const generatedAt = new Date().toISOString()

  const { data: grades, error } = await fetchGradePerformance()

  if (error || grades.length === 0) {
    return {
      generated_at:          generatedAt,
      total_feedback_events: 0,
      grade_performance:     [],
      recommendations:       [{
        priority:   'LOW',
        dimension:  'data_volume',
        observation: 'No feedback events recorded yet',
        suggestion:  'Start surfacing properties to investors; feedback events are created when deal packs are sent',
        evidence:    'scoring_feedback_events table is empty',
      }],
      data_quality: {
        has_enough_data:     false,
        min_events_per_grade: 0,
        grades_with_data:    [],
      },
      raw_error: error,
    }
  }

  const totalEvents = grades.reduce((s, g) => s + g.total_surfaced, 0)
  const minEvents   = Math.min(...grades.map(g => g.total_surfaced))
  const recommendations = generateRecommendations(grades)

  return {
    generated_at:          generatedAt,
    total_feedback_events: totalEvents,
    grade_performance:     grades,
    recommendations,
    data_quality: {
      has_enough_data:      minEvents >= 20,
      min_events_per_grade: minEvents,
      grades_with_data:     grades.map(g => g.grade),
    },
    raw_error: null,
  }
}
