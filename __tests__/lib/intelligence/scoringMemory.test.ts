// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  computeScoreDelta,
  getLeadScoreDelta,
  getDealScoreDelta,
  batchLeadDeltas,
  batchDealDeltas,
  updateLeadScoreMemory,
  updateDealScoreMemory,
} from '../../../app/portal/lib/intelligence/scoringMemory'
import type { ScoredContact } from '../../../app/portal/lib/leadScoring'
import type { ScoredDeal } from '../../../app/portal/lib/dealScoring'

// ─── Factories ────────────────────────────────────────────────────────────────

function makeScoredContact(id: number, score: number): ScoredContact {
  return {
    contact: { id } as ScoredContact['contact'],
    scoring: { score } as ScoredContact['scoring'],
  }
}

function makeScoredDeal(id: number, dealScore: number): ScoredDeal {
  return {
    deal: { id } as ScoredDeal['deal'],
    scoring: { dealScore } as ScoredDeal['scoring'],
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
})

// ─── computeScoreDelta ────────────────────────────────────────────────────────

describe('computeScoreDelta — no history', () => {
  it('1. returns trend=new and delta=null when no prior snapshot exists', () => {
    const result = computeScoreDelta('entity_1', 50)
    expect(result.trend).toBe('new')
    expect(result.delta).toBeNull()
    expect(result.previous).toBeNull()
    expect(result.percentChange).toBeNull()
    expect(result.current).toBe(50)
  })
})

describe('computeScoreDelta — trend detection', () => {
  it('2. improving by >3 points → trend=improving', () => {
    updateLeadScoreMemory([makeScoredContact(99, 60)])
    const result = computeScoreDelta('lead_99', 65)
    expect(result.trend).toBe('improving')
  })

  it('3. declining by >3 points → trend=declining', () => {
    updateLeadScoreMemory([makeScoredContact(99, 70)])
    const result = computeScoreDelta('lead_99', 64)
    expect(result.trend).toBe('declining')
  })

  it('4. change ≤3 points → trend=stable', () => {
    updateLeadScoreMemory([makeScoredContact(99, 50)])
    const result = computeScoreDelta('lead_99', 53)
    expect(result.trend).toBe('stable')
  })
})

describe('computeScoreDelta — percentChange', () => {
  it('5. percentChange is correct: previous=50, current=60 → 20.0', () => {
    updateLeadScoreMemory([makeScoredContact(42, 50)])
    const result = computeScoreDelta('lead_42', 60)
    expect(result.percentChange).toBe(20.0)
  })

  it('6. percentChange is null when previous = 0', () => {
    updateLeadScoreMemory([makeScoredContact(43, 0)])
    const result = computeScoreDelta('lead_43', 10)
    expect(result.percentChange).toBeNull()
  })
})

// ─── updateLeadScoreMemory ────────────────────────────────────────────────────

describe('updateLeadScoreMemory', () => {
  it('7. after first update previous=null; after second update previous matches first score', () => {
    // First call — no history yet, so delta reads null previous
    updateLeadScoreMemory([makeScoredContact(10, 55)])
    const afterFirst = getLeadScoreDelta(10, 55)
    expect(afterFirst.previous).toBeNull()

    // Second call — now previous should be the score stored by the first call
    updateLeadScoreMemory([makeScoredContact(10, 70)])
    const afterSecond = getLeadScoreDelta(10, 70)
    expect(afterSecond.previous).toBe(55)
  })
})

// ─── updateDealScoreMemory ────────────────────────────────────────────────────

describe('updateDealScoreMemory', () => {
  it('8. after first update previous=null; after second update previous matches first score', () => {
    updateDealScoreMemory([makeScoredDeal(20, 65)])
    const afterFirst = getDealScoreDelta(20, 65)
    expect(afterFirst.previous).toBeNull()

    updateDealScoreMemory([makeScoredDeal(20, 80)])
    const afterSecond = getDealScoreDelta(20, 80)
    expect(afterSecond.previous).toBe(65)
  })
})

// ─── MAX_HISTORY cap ──────────────────────────────────────────────────────────

describe('MAX_HISTORY = 3', () => {
  it('9. after 4 updates, getLeadScoreDelta still returns only data from the most recent 3 snapshots', () => {
    updateLeadScoreMemory([makeScoredContact(30, 10)])
    updateLeadScoreMemory([makeScoredContact(30, 20)])
    updateLeadScoreMemory([makeScoredContact(30, 30)])
    updateLeadScoreMemory([makeScoredContact(30, 40)])

    // After 4 writes, the oldest entry (10) should be gone.
    // The most recent snapshot is 40, so previous should be 30 (the third entry).
    const result = getLeadScoreDelta(30, 40)
    expect(result.previous).toBe(30)
  })
})

// ─── batchLeadDeltas / batchDealDeltas ───────────────────────────────────────

describe('batchLeadDeltas', () => {
  it('10. returns a Map keyed by contact.id', () => {
    const contacts = [
      makeScoredContact(1, 60),
      makeScoredContact(2, 45),
      makeScoredContact(3, 80),
    ]
    const result = batchLeadDeltas(contacts)
    expect(result).toBeInstanceOf(Map)
    expect(result.has(1)).toBe(true)
    expect(result.has(2)).toBe(true)
    expect(result.has(3)).toBe(true)
    expect(result.get(1)?.current).toBe(60)
    expect(result.get(2)?.current).toBe(45)
    expect(result.get(3)?.current).toBe(80)
  })
})

describe('batchDealDeltas', () => {
  it('11. returns a Map keyed by deal.id', () => {
    const deals = [
      makeScoredDeal(100, 72),
      makeScoredDeal(101, 55),
    ]
    const result = batchDealDeltas(deals)
    expect(result).toBeInstanceOf(Map)
    expect(result.has(100)).toBe(true)
    expect(result.has(101)).toBe(true)
    expect(result.get(100)?.current).toBe(72)
    expect(result.get(101)?.current).toBe(55)
  })
})

// ─── SSR-safety (no-throw) ────────────────────────────────────────────────────

describe('SSR-safe behaviour', () => {
  it('12. computeScoreDelta does not throw in jsdom environment', () => {
    expect(() => computeScoreDelta('some_key', 42)).not.toThrow()
  })
})

// ─── getLeadScoreDelta / getDealScoreDelta with no history ───────────────────

describe('getLeadScoreDelta — no history', () => {
  it('13. returns ScoreDelta with trend=new', () => {
    const result = getLeadScoreDelta(999, 50)
    expect(result.trend).toBe('new')
    expect(result.delta).toBeNull()
  })
})

describe('getDealScoreDelta — no history', () => {
  it('14. returns ScoreDelta with trend=new', () => {
    const result = getDealScoreDelta(888, 75)
    expect(result.trend).toBe('new')
    expect(result.delta).toBeNull()
  })
})

// ─── delta arithmetic ─────────────────────────────────────────────────────────

describe('computeScoreDelta — delta value', () => {
  it('15. delta = current - previous (numerically correct)', () => {
    updateLeadScoreMemory([makeScoredContact(50, 40)])
    const result = computeScoreDelta('lead_50', 65)
    expect(result.delta).toBe(25)
    expect(result.previous).toBe(40)
    expect(result.current).toBe(65)
  })
})

describe('computeScoreDelta — percentChange precision', () => {
  it('16. percentChange rounded to 1dp: previous=100, current=133 → ~33.0', () => {
    updateLeadScoreMemory([makeScoredContact(60, 100)])
    const result = computeScoreDelta('lead_60', 133)
    // 33/100 * 100 = 33.0
    expect(result.percentChange).toBeCloseTo(33.0, 1)
  })
})
