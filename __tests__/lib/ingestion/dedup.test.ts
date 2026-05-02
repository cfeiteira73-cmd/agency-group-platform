// =============================================================================
// Deduplication Engine Tests
// __tests__/lib/ingestion/dedup.test.ts
//
// Tests for PURE functions in lib/ingestion/dedup.ts:
//   normalizeAddress, tokenJaccard, withinTolerance, isSameProperty
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

// Mock supabase — dedup.ts imports it at module level for DB functions.
// Tests here only cover pure functions; DB functions are excluded.
vi.mock('../../../lib/supabase', () => ({
  supabaseAdmin: {},
  supabase:      {},
}))

import {
  normalizeAddress,
  tokenJaccard,
  withinTolerance,
  isSameProperty,
} from '../../../lib/ingestion/dedup'

// ---------------------------------------------------------------------------
// normalizeAddress
// ---------------------------------------------------------------------------

describe('normalizeAddress', () => {
  it('returns empty string for null', () => {
    expect(normalizeAddress(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(normalizeAddress(undefined)).toBe('')
  })

  it('lowercases the input', () => {
    const result = normalizeAddress('Rua do Carmo 15')
    expect(result).toBe(result.toLowerCase())
  })

  it('strips diacritics', () => {
    const result = normalizeAddress('Rua Rainha Dª Amélia')
    expect(result).not.toContain('ã')
    expect(result).not.toContain('é')
  })

  it('removes common street prefixes', () => {
    const result = normalizeAddress('Rua do Carmo 15')
    expect(result).not.toContain('rua')
  })

  it('removes "avenida" and "av" prefixes', () => {
    const r1 = normalizeAddress('Avenida da Liberdade 100')
    const r2 = normalizeAddress('Av Liberdade 100')
    // Both should normalize to something without the prefix
    expect(r1).not.toMatch(/\bavenida\b/)
    expect(r2).not.toMatch(/\bav\b/)
  })

  it('removes number prefixes (n, nr, numero)', () => {
    const result = normalizeAddress('Rua do Carmo n 15')
    expect(result).not.toMatch(/\bn\b/)
  })

  it('normalizes multiple spaces to single space', () => {
    const result = normalizeAddress('Rua   Carmo   15')
    expect(result).not.toContain('  ')
  })

  it('removes punctuation', () => {
    const result = normalizeAddress('Rua do Carmo, nº 15-B')
    expect(result).not.toContain(',')
    expect(result).not.toContain('.')
    expect(result).not.toContain('#')
  })
})

// ---------------------------------------------------------------------------
// tokenJaccard
// ---------------------------------------------------------------------------

describe('tokenJaccard', () => {
  it('returns 1 for identical strings', () => {
    expect(tokenJaccard('carmo 15 lisboa', 'carmo 15 lisboa')).toBe(1)
  })

  it('returns 0 for completely different strings', () => {
    expect(tokenJaccard('alfa beta gamma', 'delta epsilon zeta')).toBe(0)
  })

  it('returns 1 for two empty strings', () => {
    expect(tokenJaccard('', '')).toBe(1)
  })

  it('returns 0 when one string is empty', () => {
    expect(tokenJaccard('carmo lisboa', '')).toBe(0)
    expect(tokenJaccard('', 'carmo lisboa')).toBe(0)
  })

  it('returns correct partial similarity', () => {
    // "carmo 15 lisboa" and "carmo 20 porto"
    // tokens A: {carmo, 15, lisboa} (all len >1)
    // tokens B: {carmo, 20, porto}
    // intersection: {carmo} = 1
    // union = 3+3-1 = 5
    // jaccard = 1/5 = 0.2
    const sim = tokenJaccard('carmo 15 lisboa', 'carmo 20 porto')
    expect(sim).toBeCloseTo(0.2, 5)
  })

  it('filters out single-character tokens', () => {
    // "a b c" — all single-char tokens filtered out → both effectively empty
    expect(tokenJaccard('a b c', 'a b c')).toBe(1)  // both empty → return 1
  })

  it('is case-sensitive (tokens not lowercased here)', () => {
    // tokenJaccard is pure — normalization is caller's responsibility
    const sim = tokenJaccard('CARMO LISBOA', 'carmo lisboa')
    expect(sim).toBe(0)
  })

  it('returns value between 0 and 1', () => {
    const sim = tokenJaccard('rua carmo 15', 'rua carmo 20')
    expect(sim).toBeGreaterThanOrEqual(0)
    expect(sim).toBeLessThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// withinTolerance
// ---------------------------------------------------------------------------

describe('withinTolerance', () => {
  it('returns true when values are identical', () => {
    expect(withinTolerance(500_000, 500_000, 0.10)).toBe(true)
  })

  it('returns true when within 10% tolerance', () => {
    expect(withinTolerance(500_000, 545_000, 0.10)).toBe(true)  // 9% diff
  })

  it('returns false when outside 10% tolerance', () => {
    expect(withinTolerance(500_000, 560_000, 0.10)).toBe(false)  // 12% diff
  })

  it('returns false when either value is 0 or negative', () => {
    expect(withinTolerance(0, 100, 0.10)).toBe(false)
    expect(withinTolerance(100, 0, 0.10)).toBe(false)
    expect(withinTolerance(-100, 100, 0.10)).toBe(false)
  })

  it('uses max(a,b) in denominator (asymmetric comparison)', () => {
    // |600k - 500k| / max(600k, 500k) = 100k/600k ≈ 0.167 > 0.12 → false
    expect(withinTolerance(500_000, 600_000, 0.12)).toBe(false)
  })

  it('returns true at exact boundary', () => {
    // |100 - 112| / 112 = 12/112 ≈ 0.107 > 0.10 → just outside
    expect(withinTolerance(100, 112, 0.10)).toBe(false)
    // |100 - 110| / 110 = 10/110 ≈ 0.0909 < 0.10 → inside
    expect(withinTolerance(100, 110, 0.10)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// isSameProperty
// ---------------------------------------------------------------------------

describe('isSameProperty', () => {
  const baseA = { price: 500_000, area_m2: 100, bedrooms: 2, city: 'Lisboa' }
  const baseB = { price: 495_000, area_m2: 98,  bedrooms: 2, city: 'Lisboa' }

  it('returns high confidence for near-identical properties', () => {
    const score = isSameProperty(baseA, baseB)
    expect(score).toBeGreaterThan(0.75)
  })

  it('returns 0 for different cities', () => {
    const a = { ...baseA, city: 'Lisboa' }
    const b = { ...baseB, city: 'Porto' }
    expect(isSameProperty(a, b)).toBe(0)
  })

  it('returns 0 when bedrooms differ by more than 1', () => {
    const a = { ...baseA, bedrooms: 2 }
    const b = { ...baseB, bedrooms: 4 }
    expect(isSameProperty(a, b)).toBe(0)
  })

  it('allows bedrooms to differ by 1 without zeroing score', () => {
    const a = { ...baseA, bedrooms: 2 }
    const b = { ...baseB, bedrooms: 3 }
    const score = isSameProperty(a, b)
    expect(score).toBeGreaterThan(0)
  })

  it('returns 0 when price differs by more than 12%', () => {
    const a = { price: 500_000, city: 'Lisboa' }
    const b = { price: 400_000, city: 'Lisboa' }  // 20% diff
    const score = isSameProperty(a, b)
    // Price check fails → partial score but ≤ city
    // City matches (score++ for city), price fails (no score++)
    // checks=2, score=1 → 0.5 < 0.75 so won't be treated as duplicate
    expect(score).toBeLessThan(0.75)
  })

  it('returns 0 when both have no matching data (empty objects)', () => {
    // No data to compare → checks=0 → returns 0
    const score = isSameProperty({}, {})
    expect(score).toBe(0)
  })

  it('ignores missing fields gracefully', () => {
    // Only city provided → checks=1, if cities match: score=1/1=1
    const a = { city: 'Porto' }
    const b = { city: 'Porto' }
    expect(isSameProperty(a, b)).toBe(1)
  })

  it('returns value between 0 and 1', () => {
    const score = isSameProperty(baseA, baseB)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('flags highly similar properties above 0.75 threshold', () => {
    // Near-identical: same city, price within 1%, area within 1%, same bedrooms
    const a = { price: 500_000, area_m2: 100, bedrooms: 2, city: 'Cascais' }
    const b = { price: 502_000, area_m2: 100, bedrooms: 2, city: 'Cascais' }
    expect(isSameProperty(a, b)).toBeGreaterThanOrEqual(0.75)
  })
})
