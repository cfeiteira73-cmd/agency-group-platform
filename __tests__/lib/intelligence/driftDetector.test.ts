// =============================================================================
// Tests — lib/intelligence/driftDetector.ts
// Pure function tests only (no DB calls)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

// Must mock supabase BEFORE importing the module under test
vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  pearsonCorrelation,
  classifyDrift,
  analyzeFeedbackSamples,
  generateDriftRecommendations,
  buildDriftReport,
} from '../../../lib/intelligence/driftDetector'
import type { FeedbackSample } from '../../../lib/intelligence/driftDetector'

// ---------------------------------------------------------------------------
// Helpers — must match the FeedbackSample interface exactly
// ---------------------------------------------------------------------------

function makeSample(overrides: Partial<FeedbackSample> = {}): FeedbackSample {
  return {
    opportunity_score:   72,
    opportunity_grade:   'A',
    predicted_yield:     null,
    realized_yield:      null,
    avm_value_at_time:   400_000,
    realized_sale_price: 410_000,
    realized_dom:        65,
    close_status:        'won',
    deal_won:            true,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// pearsonCorrelation
// ---------------------------------------------------------------------------

describe('pearsonCorrelation', () => {
  it('returns null for empty arrays', () => {
    expect(pearsonCorrelation([], [])).toBeNull()
  })

  it('returns null for arrays shorter than 5', () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [1, 2, 3, 4])).toBeNull()
  })

  it('returns 1.0 for perfect positive correlation', () => {
    const xs = [1, 2, 3, 4, 5]
    const ys = [2, 4, 6, 8, 10]
    const r = pearsonCorrelation(xs, ys)
    expect(r).not.toBeNull()
    expect(r!).toBeCloseTo(1.0, 4)
  })

  it('returns -1.0 for perfect negative correlation', () => {
    const xs = [1, 2, 3, 4, 5]
    const ys = [10, 8, 6, 4, 2]
    const r = pearsonCorrelation(xs, ys)
    expect(r).not.toBeNull()
    expect(r!).toBeCloseTo(-1.0, 4)
  })

  it('returns null when y has zero variance (constant)', () => {
    const xs = [1, 2, 3, 4, 5]
    const ys = [3, 3, 3, 3, 3]
    const r = pearsonCorrelation(xs, ys)
    expect(r).toBeNull()
  })

  it('returns value in [-1, 1] for real data', () => {
    const xs = [10, 20, 30, 40, 50]
    const ys = [15, 22, 28, 45, 48]
    const r = pearsonCorrelation(xs, ys)
    expect(r).not.toBeNull()
    expect(r!).toBeGreaterThanOrEqual(-1)
    expect(r!).toBeLessThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// classifyDrift
// ---------------------------------------------------------------------------

describe('classifyDrift', () => {
  describe('avm_accuracy dimension', () => {
    it('NONE below 5%', () => {
      expect(classifyDrift('avm_accuracy', 4.9)).toBe('NONE')
    })
    it('MILD at 5%', () => {
      expect(classifyDrift('avm_accuracy', 5)).toBe('MILD')
    })
    it('SIGNIFICANT at 10%', () => {
      expect(classifyDrift('avm_accuracy', 10)).toBe('SIGNIFICANT')
    })
    it('CRITICAL at 20%', () => {
      expect(classifyDrift('avm_accuracy', 20)).toBe('CRITICAL')
    })
    it('CRITICAL above 20%', () => {
      expect(classifyDrift('avm_accuracy', 25)).toBe('CRITICAL')
    })
  })

  describe('yield_accuracy dimension', () => {
    it('NONE below 1%', () => {
      expect(classifyDrift('yield_accuracy', 0.9)).toBe('NONE')
    })
    it('MILD at 1%', () => {
      expect(classifyDrift('yield_accuracy', 1)).toBe('MILD')
    })
    it('SIGNIFICANT at 2%', () => {
      expect(classifyDrift('yield_accuracy', 2)).toBe('SIGNIFICANT')
    })
    it('CRITICAL at 3%', () => {
      expect(classifyDrift('yield_accuracy', 3)).toBe('CRITICAL')
    })
  })

  describe('dom_accuracy dimension', () => {
    it('NONE below 15 days', () => {
      expect(classifyDrift('dom_accuracy', 14)).toBe('NONE')
    })
    it('MILD at 15 days', () => {
      expect(classifyDrift('dom_accuracy', 15)).toBe('MILD')
    })
    it('SIGNIFICANT at 30 days', () => {
      expect(classifyDrift('dom_accuracy', 30)).toBe('SIGNIFICANT')
    })
    it('CRITICAL at 60 days', () => {
      expect(classifyDrift('dom_accuracy', 60)).toBe('CRITICAL')
    })
  })

  it('unknown dimension defaults to NONE', () => {
    expect(classifyDrift('unknown_dim', 999)).toBe('NONE')
  })

  it('null mae returns NONE', () => {
    expect(classifyDrift('avm_accuracy', null)).toBe('NONE')
  })
})

// ---------------------------------------------------------------------------
// analyzeFeedbackSamples
// ---------------------------------------------------------------------------

describe('analyzeFeedbackSamples', () => {
  it('handles empty array gracefully', () => {
    const stats = analyzeFeedbackSamples([])
    expect(stats.total_samples).toBe(0)
    expect(stats.avm_accuracy.mae).toBeNull()
    expect(stats.avm_accuracy.samples).toBe(0)
  })

  it('computes correct grade hit rates', () => {
    const samples = [
      makeSample({ opportunity_grade: 'A', deal_won: true,  close_status: 'won'  }),
      makeSample({ opportunity_grade: 'A', deal_won: true,  close_status: 'won'  }),
      makeSample({ opportunity_grade: 'A', deal_won: false, close_status: 'lost' }),
      makeSample({ opportunity_grade: 'A', deal_won: false, close_status: 'lost' }),
      makeSample({ opportunity_grade: 'A', deal_won: false, close_status: 'lost' }),
    ]
    const stats = analyzeFeedbackSamples(samples)
    expect(stats.total_samples).toBe(5)
    // 5 samples for 'A' → rate is computed (needs ≥5)
    const aRate = stats.grade_hit_rates['A']?.rate
    expect(aRate).not.toBeNull()
    expect(aRate).toBeCloseTo(40, 0)  // 2 won / 5 total = 40%
  })

  it('grade rate is null when fewer than 5 samples', () => {
    const samples = [
      makeSample({ opportunity_grade: 'A+', deal_won: true }),
      makeSample({ opportunity_grade: 'A+', deal_won: true }),
    ]
    const stats = analyzeFeedbackSamples(samples)
    expect(stats.grade_hit_rates['A+']?.rate).toBeNull()
  })

  it('computes AVM MAE from samples with AVM data', () => {
    const samples = [
      makeSample({ avm_value_at_time: 400_000, realized_sale_price: 420_000 }),  // +5%
      makeSample({ avm_value_at_time: 400_000, realized_sale_price: 380_000 }),  // -5%
    ]
    const stats = analyzeFeedbackSamples(samples)
    expect(stats.avm_accuracy.mae).not.toBeNull()
    expect(stats.avm_accuracy.mae!).toBeCloseTo(5.0, 1)
    // mean error should be ~0 (symmetric errors cancel)
    expect(stats.avm_accuracy.mean_error).toBeCloseTo(0.0, 1)
  })

  it('returns null AVM MAE when no AVM data', () => {
    const samples = [
      makeSample({ avm_value_at_time: null }),
      makeSample({ avm_value_at_time: null }),
    ]
    const stats = analyzeFeedbackSamples(samples)
    expect(stats.avm_accuracy.mae).toBeNull()
    expect(stats.avm_accuracy.samples).toBe(0)
  })

  it('computes DOM mean error', () => {
    const samples = [
      makeSample({ realized_dom: 60  }),
      makeSample({ realized_dom: 90  }),
      makeSample({ realized_dom: 120 }),
    ]
    const stats = analyzeFeedbackSamples(samples)
    expect(stats.dom_accuracy.mean_error).not.toBeNull()
    expect(stats.dom_accuracy.mean_error!).toBeCloseTo(90, 0)
  })

  it('handles samples without AVM or DOM data', () => {
    const samples = [
      makeSample({ avm_value_at_time: null, realized_dom: null }),
    ]
    const stats = analyzeFeedbackSamples(samples)
    expect(stats.avm_accuracy.samples).toBe(0)
  })

  it('tracks multiple grades separately', () => {
    const samples = [
      ...Array.from({ length: 5 }, () => makeSample({ opportunity_grade: 'A+', deal_won: true, close_status: 'won' })),
      ...Array.from({ length: 5 }, () => makeSample({ opportunity_grade: 'B',  deal_won: false, close_status: 'lost' })),
    ]
    const stats = analyzeFeedbackSamples(samples)
    expect(stats.grade_hit_rates['A+']?.rate).toBeCloseTo(100, 0)
    expect(stats.grade_hit_rates['B']?.rate).toBeCloseTo(0, 0)
  })

  it('total_samples includes won and lost', () => {
    const samples = [
      makeSample({ close_status: 'won',  deal_won: true  }),
      makeSample({ close_status: 'lost', deal_won: false }),
      makeSample({ close_status: null,   deal_won: false }),
    ]
    const stats = analyzeFeedbackSamples(samples)
    expect(stats.total_samples).toBe(3)
    expect(stats.with_outcome).toBe(2)  // only non-null close_status
  })
})

// ---------------------------------------------------------------------------
// generateDriftRecommendations
// ---------------------------------------------------------------------------

describe('generateDriftRecommendations', () => {
  it('returns array (possibly empty) for no issues', () => {
    const stats = analyzeFeedbackSamples([])
    const recs  = generateDriftRecommendations(stats)
    expect(Array.isArray(recs)).toBe(true)
  })

  it('generates AVM recommendation when AVM drift is CRITICAL', () => {
    // 10 samples all showing +25% AVM error → CRITICAL
    const samples = Array.from({ length: 10 }, () =>
      makeSample({ avm_value_at_time: 400_000, realized_sale_price: 500_000 }),
    )
    const stats = analyzeFeedbackSamples(samples)
    const recs  = generateDriftRecommendations(stats)
    const avmRec = recs.find(r => r.toLowerCase().includes('avm'))
    expect(avmRec).toBeDefined()
  })

  it('generates data insufficiency recommendation for <20 samples', () => {
    const stats = analyzeFeedbackSamples([makeSample()])
    const recs  = generateDriftRecommendations(stats)
    const dataRec = recs.find(r => r.includes('feedback events'))
    expect(dataRec).toBeDefined()
  })

  it('all recommendations are strings', () => {
    const stats = analyzeFeedbackSamples([makeSample()])
    const recs  = generateDriftRecommendations(stats)
    for (const r of recs) expect(typeof r).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// buildDriftReport
// ---------------------------------------------------------------------------

describe('buildDriftReport', () => {
  it('produces a valid drift report structure', () => {
    const since  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const samples = [makeSample(), makeSample({ close_status: 'lost', deal_won: false })]
    const report  = buildDriftReport(samples, since)

    expect(report).toHaveProperty('generated_at')
    expect(report).toHaveProperty('period_analyzed')
    expect(report).toHaveProperty('overall_drift_level')
    expect(report).toHaveProperty('dimensions')
    expect(report).toHaveProperty('grade_hit_rates')
    expect(report).toHaveProperty('score_correlation')
    expect(report).toHaveProperty('recommendations')
    expect(report).toHaveProperty('has_enough_data')
    expect(Array.isArray(report.dimensions)).toBe(true)
    expect(Array.isArray(report.recommendations)).toBe(true)
  })

  it('total_samples in period_analyzed matches input', () => {
    const since   = new Date()
    const samples = Array.from({ length: 7 }, makeSample)
    const report  = buildDriftReport(samples, since)
    expect(report.period_analyzed.samples).toBe(7)
  })

  it('has_enough_data is false for <20 samples', () => {
    const report = buildDriftReport([makeSample()], new Date())
    expect(report.has_enough_data).toBe(false)
  })

  it('has_enough_data is true for ≥20 samples', () => {
    const samples = Array.from({ length: 20 }, makeSample)
    const report  = buildDriftReport(samples, new Date())
    expect(report.has_enough_data).toBe(true)
  })

  it('dimensions array contains 3 items (avm/yield/dom)', () => {
    const report = buildDriftReport([makeSample()], new Date())
    expect(report.dimensions).toHaveLength(3)
    const names = report.dimensions.map(d => d.dimension)
    expect(names).toContain('avm_accuracy')
    expect(names).toContain('yield_accuracy')
    expect(names).toContain('dom_accuracy')
  })

  it('period_analyzed contains start/end/samples', () => {
    const since  = new Date('2026-01-01')
    const report = buildDriftReport([makeSample()], since)
    expect(report.period_analyzed.start).toBe(since.toISOString())
    expect(typeof report.period_analyzed.end).toBe('string')
    expect(report.period_analyzed.samples).toBe(1)
  })
})
