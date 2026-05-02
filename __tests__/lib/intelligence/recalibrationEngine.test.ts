// =============================================================================
// Tests — lib/intelligence/recalibrationEngine.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))
vi.mock('../../../lib/scoring/calibrationEngine', () => ({
  computeCalibrationReport: vi.fn(),
}))

import {
  shouldTriggerRecalibration,
  computeRecalibrationUrgency,
  rankRecommendations,
} from '../../../lib/intelligence/recalibrationEngine'
import type { CalibrationReport, CalibrationRecommendation } from '../../../lib/intelligence/recalibrationEngine'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReport(overrides: Partial<CalibrationReport> = {}): CalibrationReport {
  return {
    generated_at:          new Date().toISOString(),
    total_feedback_events: 100,
    grade_performance:     [],
    recommendations:       [],
    data_quality: {
      has_enough_data:      true,
      min_events_per_grade: 25,
      grades_with_data:     ['A+', 'A', 'B'],
    },
    raw_error: null,
    ...overrides,
  }
}

function makeRec(priority: CalibrationRecommendation['priority'], dimension = 'yield_model'): CalibrationRecommendation {
  return {
    priority,
    dimension,
    observation: `${priority} observation`,
    suggestion:  `${priority} suggestion`,
    evidence:    `${priority} evidence`,
  }
}

// ---------------------------------------------------------------------------
// shouldTriggerRecalibration
// ---------------------------------------------------------------------------

describe('shouldTriggerRecalibration', () => {
  it('not triggered when insufficient data', () => {
    const report = makeReport({
      data_quality: { has_enough_data: false, min_events_per_grade: 5, grades_with_data: [] },
    })
    const trigger = shouldTriggerRecalibration(report)
    expect(trigger.triggered).toBe(false)
    expect(trigger.urgency).toBe('none')
  })

  it('critical urgency when 1+ CRITICAL recommendations', () => {
    const report  = makeReport({ recommendations: [makeRec('CRITICAL')] })
    const trigger = shouldTriggerRecalibration(report)
    expect(trigger.triggered).toBe(true)
    expect(trigger.urgency).toBe('critical')
  })

  it('high urgency when 2+ HIGH recommendations (default threshold)', () => {
    const report  = makeReport({ recommendations: [makeRec('HIGH'), makeRec('HIGH', 'grade_thresholds')] })
    const trigger = shouldTriggerRecalibration(report)
    expect(trigger.triggered).toBe(true)
    expect(trigger.urgency).toBe('high')
  })

  it('normal urgency when 1 HIGH recommendation (below default threshold=2)', () => {
    const report  = makeReport({ recommendations: [makeRec('HIGH')] })
    const trigger = shouldTriggerRecalibration(report)
    expect(trigger.urgency).toBe('normal')
    expect(trigger.triggered).toBe(true)    // 1 > 0, so triggered=true
  })

  it('not triggered when only LOW recommendations', () => {
    const report  = makeReport({ recommendations: [makeRec('LOW')] })
    const trigger = shouldTriggerRecalibration(report)
    // LOW recs don't count: triggered = (criticals > 0 || highs > 0) = false
    expect(trigger.triggered).toBe(false)
    expect(trigger.urgency).toBe('normal')
  })

  it('counts critical and high correctly', () => {
    const report = makeReport({
      recommendations: [makeRec('CRITICAL'), makeRec('HIGH'), makeRec('LOW')],
    })
    const trigger = shouldTriggerRecalibration(report)
    expect(trigger.critical_count).toBe(1)
    expect(trigger.high_count).toBe(1)
  })

  it('custom thresholds respected', () => {
    const report = makeReport({ recommendations: [makeRec('HIGH')] })
    // With threshold 1, 1 HIGH should trigger high urgency
    const trigger = shouldTriggerRecalibration(report, 1, 1)
    expect(trigger.urgency).toBe('high')
    expect(trigger.triggered).toBe(true)
  })

  it('no trigger for empty report with enough data', () => {
    const report  = makeReport({ recommendations: [] })
    const trigger = shouldTriggerRecalibration(report)
    expect(trigger.triggered).toBe(false)
    expect(trigger.urgency).toBe('normal')
  })
})

// ---------------------------------------------------------------------------
// computeRecalibrationUrgency
// ---------------------------------------------------------------------------

describe('computeRecalibrationUrgency', () => {
  it('returns 0 for empty recs', () => {
    expect(computeRecalibrationUrgency([])).toBe(0)
  })

  it('CRITICAL = 40 points', () => {
    expect(computeRecalibrationUrgency([makeRec('CRITICAL')])).toBe(40)
  })

  it('HIGH = 20 points', () => {
    expect(computeRecalibrationUrgency([makeRec('HIGH')])).toBe(20)
  })

  it('MEDIUM = 8 points', () => {
    expect(computeRecalibrationUrgency([makeRec('MEDIUM')])).toBe(8)
  })

  it('LOW = 2 points', () => {
    expect(computeRecalibrationUrgency([makeRec('LOW')])).toBe(2)
  })

  it('capped at 100', () => {
    const recs = Array.from({ length: 10 }, () => makeRec('CRITICAL'))
    expect(computeRecalibrationUrgency(recs)).toBe(100)
  })

  it('multiple recs sum correctly', () => {
    const recs = [makeRec('CRITICAL'), makeRec('HIGH'), makeRec('MEDIUM')]
    // 40 + 20 + 8 = 68
    expect(computeRecalibrationUrgency(recs)).toBe(68)
  })
})

// ---------------------------------------------------------------------------
// rankRecommendations
// ---------------------------------------------------------------------------

describe('rankRecommendations', () => {
  it('CRITICAL comes before HIGH', () => {
    const recs    = [makeRec('HIGH'), makeRec('CRITICAL')]
    const ranked  = rankRecommendations(recs)
    expect(ranked[0].priority).toBe('CRITICAL')
    expect(ranked[1].priority).toBe('HIGH')
  })

  it('order is CRITICAL → HIGH → MEDIUM → LOW', () => {
    const recs   = [makeRec('LOW'), makeRec('MEDIUM'), makeRec('HIGH'), makeRec('CRITICAL')]
    const ranked = rankRecommendations(recs)
    expect(ranked.map(r => r.priority)).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
  })

  it('does not mutate original array', () => {
    const original = [makeRec('LOW'), makeRec('CRITICAL')]
    const copy     = [...original]
    rankRecommendations(original)
    expect(original[0].priority).toBe(copy[0].priority)
  })

  it('returns empty array for empty input', () => {
    expect(rankRecommendations([])).toEqual([])
  })
})
