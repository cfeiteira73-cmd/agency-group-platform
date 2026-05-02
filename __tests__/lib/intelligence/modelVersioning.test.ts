// =============================================================================
// Tests — lib/intelligence/modelVersioning.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  buildModelVersion,
  scoreToGrade,
  computeGradeDistribution,
  computeModelDelta,
  computeBacktestMetrics,
} from '../../../lib/intelligence/modelVersioning'
import type { SimulationResult } from '../../../lib/intelligence/modelVersioning'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(
  id:       string,
  current:  number,
  simulated: number,
  currentGrade?: string,
): SimulationResult {
  const cg = currentGrade ?? scoreToGrade(current)
  const sg  = scoreToGrade(simulated)
  return {
    property_id:     id,
    current_score:   current,
    simulated_score: simulated,
    delta:           simulated - current,
    current_grade:   cg,
    simulated_grade: sg,
    grade_changed:   cg !== sg,
  }
}

// ---------------------------------------------------------------------------
// buildModelVersion
// ---------------------------------------------------------------------------

describe('buildModelVersion', () => {
  it('builds version with required fields', () => {
    const v = buildModelVersion('v2.1-test', 'v2', { version: 'v2' })
    expect(v.version_name).toBe('v2.1-test')
    expect(v.scorer_version).toBe('v2')
    expect(v.config.version).toBe('v2')
  })

  it('description and createdBy are optional', () => {
    const v = buildModelVersion('v2.1', 'v2', { version: 'v2' }, {
      description: 'Test version',
      createdBy:   'admin@ag.com',
    })
    expect(v.description).toBe('Test version')
    expect(v.created_by).toBe('admin@ag.com')
  })

  it('config can include weights', () => {
    const config = { version: 'v2', weights: { price_vs_zone: 0.30, rental_yield: 0.25 } }
    const v      = buildModelVersion('v2.2', 'v2', config)
    expect(v.config.weights?.price_vs_zone).toBe(0.30)
  })
})

// ---------------------------------------------------------------------------
// scoreToGrade
// ---------------------------------------------------------------------------

describe('scoreToGrade', () => {
  it('A+ at 85+', ()  => expect(scoreToGrade(85)).toBe('A+'))
  it('A at 70-84', () => expect(scoreToGrade(75)).toBe('A'))
  it('B at 55-69', () => expect(scoreToGrade(60)).toBe('B'))
  it('C at 40-54', () => expect(scoreToGrade(45)).toBe('C'))
  it('D below 40', () => expect(scoreToGrade(30)).toBe('D'))

  it('boundary: 85 is A+', () => expect(scoreToGrade(85)).toBe('A+'))
  it('boundary: 84 is A',  () => expect(scoreToGrade(84)).toBe('A'))
  it('boundary: 70 is A',  () => expect(scoreToGrade(70)).toBe('A'))
  it('boundary: 69 is B',  () => expect(scoreToGrade(69)).toBe('B'))

  it('custom thresholds override defaults', () => {
    const thresholds = { grade_A_plus: 90, grade_A: 75, grade_B: 60, grade_C: 45 }
    expect(scoreToGrade(88, thresholds)).toBe('A')   // 88 < 90 → A not A+
    expect(scoreToGrade(92, thresholds)).toBe('A+')  // 92 ≥ 90
  })
})

// ---------------------------------------------------------------------------
// computeGradeDistribution
// ---------------------------------------------------------------------------

describe('computeGradeDistribution', () => {
  it('empty array returns all zeros', () => {
    const d = computeGradeDistribution([])
    expect(d['A+']).toBe(0)
    expect(d.total).toBe(0)
  })

  it('all scores sum to total', () => {
    const scores = [90, 80, 70, 60, 50, 40, 30, 20]
    const d      = computeGradeDistribution(scores)
    const sum    = d['A+'] + d['A'] + d['B'] + d['C'] + d['D']
    expect(sum).toBe(scores.length)
    expect(d.total).toBe(scores.length)
  })

  it('high scores cluster in A+/A', () => {
    const d = computeGradeDistribution([90, 88, 87, 85])
    expect(d['A+']).toBe(4)
    expect(d['A']).toBe(0)
  })

  it('mixed distribution', () => {
    const d = computeGradeDistribution([90, 75, 60, 45, 30])
    expect(d['A+']).toBe(1)
    expect(d['A']).toBe(1)
    expect(d['B']).toBe(1)
    expect(d['C']).toBe(1)
    expect(d['D']).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// computeModelDelta
// ---------------------------------------------------------------------------

describe('computeModelDelta', () => {
  it('all zeros for empty results', () => {
    const d = computeModelDelta([])
    expect(d.upgrades_vs_production).toBe(0)
    expect(d.avg_score_delta).toBe(0)
  })

  it('counts upgrades (delta > 2)', () => {
    const results = [
      makeResult('a', 60, 70),   // delta=10 → upgrade
      makeResult('b', 80, 82),   // delta=2 → not upgrade (needs >2)
      makeResult('c', 70, 60),   // delta=-10 → downgrade
    ]
    const d = computeModelDelta(results)
    expect(d.upgrades_vs_production).toBe(1)
    expect(d.downgrades_vs_production).toBe(1)
  })

  it('counts grade changes', () => {
    const results = [
      makeResult('a', 69, 71),   // B→A grade change
      makeResult('b', 80, 82),   // A→A no change
    ]
    const d = computeModelDelta(results)
    expect(d.net_change_count).toBe(1)
  })

  it('avg_score_delta is mean of all deltas', () => {
    const results = [
      makeResult('a', 60, 70),   // +10
      makeResult('b', 70, 60),   // -10
    ]
    const d = computeModelDelta(results)
    expect(d.avg_score_delta).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// computeBacktestMetrics
// ---------------------------------------------------------------------------

describe('computeBacktestMetrics', () => {
  it('returns zeros for empty results', () => {
    const m = computeBacktestMetrics([], [])
    expect(m.grade_accuracy_pct).toBe(0)
    expect(m.mean_absolute_error).toBe(0)
  })

  it('100% accuracy when high-grade = won', () => {
    const results = [
      makeResult('p1', 75, 90),   // A+
      makeResult('p2', 70, 72),   // A
    ]
    const outcomes = [
      { property_id: 'p1', won: true },
      { property_id: 'p2', won: true },
    ]
    const m = computeBacktestMetrics(results, outcomes)
    expect(m.grade_accuracy_pct).toBe(100)
  })

  it('0% accuracy when high-grade = lost', () => {
    const results  = [makeResult('p1', 75, 90)]
    const outcomes = [{ property_id: 'p1', won: false }]
    const m = computeBacktestMetrics(results, outcomes)
    expect(m.grade_accuracy_pct).toBe(0)
  })

  it('includes grade_distribution', () => {
    const results  = [makeResult('p1', 75, 90)]
    const m = computeBacktestMetrics(results, [])
    expect(m.grade_distribution['A+']).toBe(1)
    expect(m.grade_distribution.total).toBe(1)
  })

  it('includes delta metrics', () => {
    const results  = [makeResult('a', 60, 75)]   // delta=15, B→A
    const m = computeBacktestMetrics(results, [])
    expect(m.upgrades_vs_production).toBe(1)
    expect(m.net_change_count).toBe(1)
  })
})
