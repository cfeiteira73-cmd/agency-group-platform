// =============================================================================
// Presentation Score Tests
// __tests__/lib/scoring/presentationScore.test.ts
//
// Tests for lib/scoring/presentationScore.ts:
//   computePresentationScore — all 5 dimensions + opportunity bonus
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  computePresentationScore,
  type PresentationInput,
} from '../../../lib/scoring/presentationScore'

// ---------------------------------------------------------------------------
// Photo scoring (0-30 pts)
// ---------------------------------------------------------------------------

describe('Photo scoring', () => {
  it('scores 0 and flags no_photos when photos array is empty', () => {
    const result = computePresentationScore({ photos: [] })
    expect(result.breakdown.photo_score).toBe(0)
    expect(result.presentation_flags).toContain('no_photos')
  })

  it('scores 0 and flags no_photos when no photo data', () => {
    const result = computePresentationScore({})
    expect(result.breakdown.photo_score).toBe(0)
    expect(result.presentation_flags).toContain('no_photos')
  })

  it('flags too_few_photos for 1-2 photos', () => {
    const result = computePresentationScore({ num_photos: 2 })
    expect(result.presentation_flags).toContain('too_few_photos')
    expect(result.breakdown.photo_score).toBe(5)
  })

  it('scores 12 for 3-5 photos', () => {
    const result = computePresentationScore({ num_photos: 5 })
    expect(result.breakdown.photo_score).toBe(12)
    expect(result.presentation_flags).not.toContain('no_photos')
  })

  it('scores 22 for 6-10 photos', () => {
    const result = computePresentationScore({ num_photos: 8 })
    expect(result.breakdown.photo_score).toBe(22)
  })

  it('scores 30 for 20+ photos', () => {
    const result = computePresentationScore({ num_photos: 25 })
    expect(result.breakdown.photo_score).toBe(30)
  })

  it('uses photos array length when both provided', () => {
    // Array length takes precedence over num_photos
    const photos = Array.from({ length: 12 }, (_, i) => `photo${i}.jpg`)
    const result = computePresentationScore({ photos, num_photos: 3 })
    expect(result.breakdown.photo_score).toBe(28)   // 12 photos = 28 pts
  })
})

// ---------------------------------------------------------------------------
// Description scoring (0-25 pts)
// ---------------------------------------------------------------------------

describe('Description scoring', () => {
  it('scores 0 and flags no_description when missing', () => {
    const result = computePresentationScore({ description: null })
    expect(result.breakdown.description_score).toBe(0)
    expect(result.presentation_flags).toContain('no_description')
  })

  it('flags short_description for <50 chars', () => {
    const result = computePresentationScore({ description: 'Bom apartamento.' })
    expect(result.presentation_flags).toContain('short_description')
    expect(result.breakdown.description_score).toBe(5)
  })

  it('scores 12 for 50-199 char description', () => {
    const result = computePresentationScore({
      description: 'Excelente apartamento T2 situado no centro de Lisboa, com boa exposição solar e transportes próximos.',
    })
    expect(result.breakdown.description_score).toBe(12)
  })

  it('scores 18 for 200-499 char description', () => {
    const longDesc = 'Excelente apartamento T2 '.repeat(10)  // ~250 chars
    const result = computePresentationScore({ description: longDesc })
    expect(result.breakdown.description_score).toBe(18)
  })

  it('scores 25 for 500+ char description', () => {
    const veryLong = 'Excelente apartamento T2 situado no coração de Lisboa. '.repeat(12)
    const result = computePresentationScore({ description: veryLong })
    expect(result.breakdown.description_score).toBe(25)
  })

  it('awards bonus for investment keywords', () => {
    const desc = 'Excelente investimento com alto rendimento. '
      + 'Localização privilegiada com infraestruturas de qualidade. '.repeat(4)
    const result = computePresentationScore({ description: desc })
    // 200+ chars + keyword bonus = 18+2 = capped at 25
    expect(result.breakdown.description_score).toBeGreaterThan(18)
  })
})

// ---------------------------------------------------------------------------
// Title scoring (0-15 pts)
// ---------------------------------------------------------------------------

describe('Title scoring', () => {
  it('scores 0 and flags no_title when missing', () => {
    const result = computePresentationScore({ title: null })
    expect(result.breakdown.title_score).toBe(0)
    expect(result.presentation_flags).toContain('no_title')
  })

  it('flags poor_title for <10 char title', () => {
    const result = computePresentationScore({ title: 'T2 Lisboa' })
    expect(result.presentation_flags).toContain('poor_title')
    expect(result.breakdown.title_score).toBe(5)
  })

  it('scores 10 for 10-29 char title', () => {
    const result = computePresentationScore({ title: 'Apartamento T2 em Lisboa' })
    expect(result.breakdown.title_score).toBe(10)
  })

  it('scores 15 for 30+ char title', () => {
    const result = computePresentationScore({ title: 'Apartamento T2 Renovado no Chiado Lisboa' })
    expect(result.breakdown.title_score).toBe(15)
  })
})

// ---------------------------------------------------------------------------
// Floorplan scoring (0-15 pts)
// ---------------------------------------------------------------------------

describe('Floorplan scoring', () => {
  it('scores 15 when has_floorplan is true', () => {
    const result = computePresentationScore({ has_floorplan: true })
    expect(result.breakdown.floorplan_score).toBe(15)
    expect(result.presentation_flags).not.toContain('no_floorplan')
  })

  it('scores 0 and flags no_floorplan when false', () => {
    const result = computePresentationScore({ has_floorplan: false })
    expect(result.breakdown.floorplan_score).toBe(0)
    expect(result.presentation_flags).toContain('no_floorplan')
  })

  it('scores 0 when has_floorplan is not provided', () => {
    const result = computePresentationScore({})
    expect(result.breakdown.floorplan_score).toBe(0)
    expect(result.presentation_flags).toContain('no_floorplan')
  })
})

// ---------------------------------------------------------------------------
// Features scoring (0-15 pts)
// ---------------------------------------------------------------------------

describe('Features scoring', () => {
  it('scores 0 and flags no_features when empty', () => {
    const result = computePresentationScore({ features: [] })
    expect(result.breakdown.features_score).toBe(0)
    expect(result.presentation_flags).toContain('no_features')
  })

  it('scores 5 for 1-2 features', () => {
    const result = computePresentationScore({ features: ['pool', 'garage'] })
    expect(result.breakdown.features_score).toBe(5)
  })

  it('scores 8 for 3-5 features', () => {
    const result = computePresentationScore({
      features: ['pool', 'garage', 'terrace', 'lift'],
    })
    expect(result.breakdown.features_score).toBe(8)
  })

  it('scores 15 for 10+ features', () => {
    const result = computePresentationScore({
      features: Array.from({ length: 12 }, (_, i) => `feature_${i}`),
    })
    expect(result.breakdown.features_score).toBe(15)
  })
})

// ---------------------------------------------------------------------------
// Composite score and opportunity bonus
// ---------------------------------------------------------------------------

describe('Composite score and opportunity bonus', () => {
  it('computes correct composite from breakdown', () => {
    const result = computePresentationScore({
      photos:       Array.from({ length: 25 }, () => 'photo.jpg'),  // 30 pts
      description:  'Excelente apartamento T2 renovado. '.repeat(15),  // 25 pts
      title:        'Apartamento T2 Renovado no Chiado com Vista Tejo', // 15 pts
      has_floorplan: true,     // 15 pts
      features:     Array.from({ length: 12 }, (_, i) => `f${i}`),  // 15 pts
    })
    expect(result.presentation_score).toBe(100)
    expect(result.presentation_flags).toHaveLength(0)
  })

  it('caps at 100', () => {
    const perfect: PresentationInput = {
      photos:        Array.from({ length: 30 }, () => 'p.jpg'),
      description:   'a'.repeat(600),
      title:         'Apartamento T2 Premium em Lisboa com Vista',
      has_floorplan: true,
      features:      Array.from({ length: 15 }, (_, i) => `f${i}`),
    }
    const result = computePresentationScore(perfect)
    expect(result.presentation_score).toBeLessThanOrEqual(100)
  })

  it('opportunity_bonus is 15 for very poorly presented listing', () => {
    // No photos, no description, no title, no floorplan, no features → score ~0
    const result = computePresentationScore({})
    expect(result.presentation_score).toBeLessThan(40)
    expect(result.presentation_opportunity_bonus).toBe(15)
  })

  it('opportunity_bonus is 0 for well-presented listing', () => {
    const result = computePresentationScore({
      num_photos:    25,
      description:   'Great listing. '.repeat(40),
      title:         'Premium Lisboa Apartment With Terrace View',
      has_floorplan: true,
      features:      ['pool', 'lift', 'garage', 'terrace', 'ac', 'gym', 'spa', 'view', 'parking', 'storage'],
    })
    expect(result.presentation_score).toBeGreaterThanOrEqual(80)
    expect(result.presentation_opportunity_bonus).toBe(0)
  })

  it('opportunity_bonus is 8 for below-average listing (40-59)', () => {
    // Moderate listing: some photos, medium description, no floorplan
    const result = computePresentationScore({
      num_photos:    6,       // 22 pts
      description:   'Bom apartamento T2 em Lisboa, com boa localização e transportes públicos próximos.',  // 82 chars = 12 pts
      title:         'Apartamento T2 Lisboa',   // 21 chars = 10 pts
      has_floorplan: false,                     // 0 pts
      features:      [],                        // 0 pts
    })
    // 22+12+10+0+0 = 44 pts — in [40,60) range
    expect(result.presentation_score).toBeGreaterThanOrEqual(40)
    expect(result.presentation_score).toBeLessThan(60)
    expect(result.presentation_opportunity_bonus).toBe(8)
  })
})
