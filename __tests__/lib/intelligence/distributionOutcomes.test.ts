// =============================================================================
// Tests — lib/intelligence/distributionOutcomes.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  computeRecipientROI,
  computeFatigueScore,
  isRecipientFatigued,
  computeCooldownUntil,
  buildDistributionOutcome,
} from '../../../lib/intelligence/distributionOutcomes'
import type { RecipientPerformanceProfile } from '../../../lib/intelligence/distributionOutcomes'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProfile(
  overrides: Partial<RecipientPerformanceProfile> = {},
): RecipientPerformanceProfile {
  return {
    recipient_email:       'test@ag.com',
    recipient_type:        'agent',
    total_distributions:   20,
    total_opens:           15,
    total_replies:         10,
    total_meetings:         5,
    total_offers:           3,
    total_won:              2,
    open_rate:             0.75,
    reply_rate:            0.50,
    meeting_rate:          0.25,
    offer_rate:            0.15,
    close_rate:            0.10,
    avg_commission:        null,
    total_commission:      null,
    roi_score:             null,
    distributions_last_7d:  1,
    distributions_last_30d: 5,
    last_distributed_at:   null,
    fatigue_score:         0,
    is_fatigued:           false,
    cooldown_until:        null,
    last_computed_at:      new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// computeRecipientROI
// ---------------------------------------------------------------------------

describe('computeRecipientROI', () => {
  it('returns 0 when no distributions', () => {
    expect(computeRecipientROI({ close_rate: 0.5, reply_rate: 0.5, total_distributions: 0, total_commission: null })).toBe(0)
  })

  it('formula: closeRate*100*0.6 + replyRate*100*0.4', () => {
    const roi = computeRecipientROI({
      close_rate:          0.20,   // 20 * 0.6 = 12
      reply_rate:          0.50,   // 50 * 0.4 = 20
      total_distributions: 10,
      total_commission:    null,
    })
    expect(roi).toBeCloseTo(32, 0)
  })

  it('null rates treated as 0', () => {
    const roi = computeRecipientROI({
      close_rate: null, reply_rate: null,
      total_distributions: 5, total_commission: null,
    })
    expect(roi).toBe(0)
  })

  it('capped at 100', () => {
    const roi = computeRecipientROI({
      close_rate: 1.0, reply_rate: 1.0,
      total_distributions: 10, total_commission: null,
    })
    expect(roi).toBe(100)
  })

  it('high close rate dominates (0.6 weight)', () => {
    const highClose = computeRecipientROI({ close_rate: 0.80, reply_rate: 0.10, total_distributions: 10, total_commission: null })
    const highReply = computeRecipientROI({ close_rate: 0.10, reply_rate: 0.80, total_distributions: 10, total_commission: null })
    expect(highClose).toBeGreaterThan(highReply)
  })
})

// ---------------------------------------------------------------------------
// computeFatigueScore
// ---------------------------------------------------------------------------

describe('computeFatigueScore', () => {
  it('zero distributions = 0 fatigue', () => {
    expect(computeFatigueScore(0, 0)).toBe(0)
  })

  it('5 distributions in 7d + 10 in 30d = 75 → capped at 100? No, 75', () => {
    // 5*15 + 10*3 = 75 + 30 = 105 → capped
    expect(computeFatigueScore(5, 10)).toBe(100)
  })

  it('1 distribution in 7d + 2 in 30d = 15+6 = 21', () => {
    expect(computeFatigueScore(1, 2)).toBe(21)
  })

  it('2 distributions in 7d + 5 in 30d = 30+15 = 45', () => {
    expect(computeFatigueScore(2, 5)).toBe(45)
  })

  it('capped at 100', () => {
    expect(computeFatigueScore(10, 50)).toBe(100)
  })

  it('always non-negative', () => {
    expect(computeFatigueScore(0, 0)).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// isRecipientFatigued
// ---------------------------------------------------------------------------

describe('isRecipientFatigued', () => {
  it('not fatigued with low scores', () => {
    expect(isRecipientFatigued({ fatigue_score: 30, distributions_last_7d: 2, cooldown_until: null })).toBe(false)
  })

  it('fatigued when fatigue_score > 60', () => {
    expect(isRecipientFatigued({ fatigue_score: 61, distributions_last_7d: 2, cooldown_until: null })).toBe(true)
  })

  it('fatigued when distributions_last_7d > 4', () => {
    expect(isRecipientFatigued({ fatigue_score: 30, distributions_last_7d: 5, cooldown_until: null })).toBe(true)
  })

  it('fatigued when still in cooldown window', () => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    expect(isRecipientFatigued({ fatigue_score: 10, distributions_last_7d: 1, cooldown_until: future })).toBe(true)
  })

  it('not fatigued when cooldown has expired', () => {
    const past = new Date(Date.now() - 3600_000).toISOString()
    expect(isRecipientFatigued({ fatigue_score: 10, distributions_last_7d: 1, cooldown_until: past })).toBe(false)
  })

  it('boundary: fatigue_score = 60 is NOT fatigued (> 60 required)', () => {
    expect(isRecipientFatigued({ fatigue_score: 60, distributions_last_7d: 2, cooldown_until: null })).toBe(false)
  })

  it('boundary: distributions_last_7d = 4 is NOT fatigued (> 4 required)', () => {
    expect(isRecipientFatigued({ fatigue_score: 30, distributions_last_7d: 4, cooldown_until: null })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// computeCooldownUntil
// ---------------------------------------------------------------------------

describe('computeCooldownUntil', () => {
  it('returns ISO string 48h in the future', () => {
    const from     = new Date('2026-05-02T10:00:00.000Z')
    const expected = new Date('2026-05-04T10:00:00.000Z')
    expect(computeCooldownUntil(from)).toBe(expected.toISOString())
  })

  it('returns string', () => {
    expect(typeof computeCooldownUntil()).toBe('string')
  })

  it('result is always in the future', () => {
    const result = new Date(computeCooldownUntil()).getTime()
    expect(result).toBeGreaterThan(Date.now())
  })
})

// ---------------------------------------------------------------------------
// buildDistributionOutcome
// ---------------------------------------------------------------------------

describe('buildDistributionOutcome', () => {
  it('builds minimal outcome', () => {
    const o = buildDistributionOutcome('evt-1', 'prop-1', 'agent@test.com', 'agent')
    expect(o.distribution_event_id).toBe('evt-1')
    expect(o.property_id).toBe('prop-1')
    expect(o.recipient_email).toBe('agent@test.com')
    expect(o.recipient_type).toBe('agent')
    expect(o.outcome).toBeUndefined()
  })

  it('passes through all optional fields', () => {
    const o = buildDistributionOutcome('evt-1', 'prop-1', 'inv@test.com', 'investor', {
      tier:             'ELITE',
      rank:             1,
      outcome:          'won',
      openedAt:         '2026-05-01T10:00:00Z',
      repliedAt:        '2026-05-02T10:00:00Z',
      closedAt:         '2026-05-10T10:00:00Z',
      timeToReplyHours: 24,
      timeToCloseDays:  9,
    })
    expect(o.recipient_tier).toBe('ELITE')
    expect(o.distribution_rank).toBe(1)
    expect(o.outcome).toBe('won')
    expect(o.opened_at).toBe('2026-05-01T10:00:00Z')
    expect(o.time_to_reply_hours).toBe(24)
    expect(o.time_to_close_days).toBe(9)
  })
})
