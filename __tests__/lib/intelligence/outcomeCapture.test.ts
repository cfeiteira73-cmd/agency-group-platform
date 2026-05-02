// =============================================================================
// Tests — lib/intelligence/outcomeCapture.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  computeNegotiationDelta,
  computeAvmError,
  classifyRejectionCategory,
  buildTransactionOutcome,
  buildRejectionRecord,
} from '../../../lib/intelligence/outcomeCapture'

// ---------------------------------------------------------------------------
// computeNegotiationDelta
// ---------------------------------------------------------------------------

describe('computeNegotiationDelta', () => {
  it('positive delta when sold above ask', () => {
    const delta = computeNegotiationDelta(500_000, 520_000)
    expect(delta).toBeCloseTo(4, 1)    // +4%
  })

  it('negative delta when sold below ask', () => {
    const delta = computeNegotiationDelta(500_000, 475_000)
    expect(delta).toBeCloseTo(-5, 1)   // -5%
  })

  it('zero delta when sold at ask', () => {
    expect(computeNegotiationDelta(500_000, 500_000)).toBe(0)
  })

  it('null when askPrice = 0', () => {
    expect(computeNegotiationDelta(0, 500_000)).toBeNull()
  })

  it('null when askPrice is negative', () => {
    expect(computeNegotiationDelta(-1, 500_000)).toBeNull()
  })

  it('returns number with 4 decimal precision', () => {
    const delta = computeNegotiationDelta(500_000, 510_000)
    expect(typeof delta).toBe('number')
    expect(String(delta).replace(/^-?\d+\.?/, '').length).toBeLessThanOrEqual(4)
  })

  it('luxury deal — small delta', () => {
    const delta = computeNegotiationDelta(3_000_000, 2_850_000)
    expect(delta).toBeCloseTo(-5, 1)
  })
})

// ---------------------------------------------------------------------------
// computeAvmError
// ---------------------------------------------------------------------------

describe('computeAvmError', () => {
  it('positive error when AVM overestimated', () => {
    const err = computeAvmError(550_000, 500_000)
    expect(err).toBeCloseTo(10, 1)     // AVM 10% too high
  })

  it('negative error when AVM underestimated', () => {
    const err = computeAvmError(450_000, 500_000)
    expect(err).toBeCloseTo(-10, 1)    // AVM 10% too low
  })

  it('zero error when AVM = sale price', () => {
    expect(computeAvmError(500_000, 500_000)).toBe(0)
  })

  it('null when salePrice = 0', () => {
    expect(computeAvmError(500_000, 0)).toBeNull()
  })

  it('null when salePrice is negative', () => {
    expect(computeAvmError(500_000, -1)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// classifyRejectionCategory
// ---------------------------------------------------------------------------

describe('classifyRejectionCategory', () => {
  it('price keywords → price', () => {
    expect(classifyRejectionCategory('preço muito elevado')).toBe('price')
    expect(classifyRejectionCategory('price is too high')).toBe('price')
    expect(classifyRejectionCategory('overpriced for the area')).toBe('price')
  })

  it('location keywords → location', () => {
    expect(classifyRejectionCategory('wrong location')).toBe('location')
    expect(classifyRejectionCategory('localização não adequada')).toBe('location')
  })

  it('financing keywords → financing', () => {
    expect(classifyRejectionCategory('financing fell through')).toBe('financing')
    expect(classifyRejectionCategory('banco recusou crédito')).toBe('financing')
  })

  it('competitor keywords → competition', () => {
    expect(classifyRejectionCategory('outbid by another buyer')).toBe('competition')
    expect(classifyRejectionCategory('lost to a concorrente')).toBe('competition')
  })

  it('due diligence keywords → due_diligence', () => {
    expect(classifyRejectionCategory('due diligence issues found')).toBe('due_diligence')
  })

  it('seller withdrawal keywords → seller_withdrawal', () => {
    expect(classifyRejectionCategory('vendedor retirou a propriedade')).toBe('seller_withdrawal')
    expect(classifyRejectionCategory('seller withdrew from sale')).toBe('seller_withdrawal')
  })

  it('unknown reason → other', () => {
    expect(classifyRejectionCategory('just changed my mind')).toBe('other')
  })

  it('valuation keywords → valuation_mismatch', () => {
    expect(classifyRejectionCategory('avm diverge muito')).toBe('valuation_mismatch')
  })
})

// ---------------------------------------------------------------------------
// buildTransactionOutcome
// ---------------------------------------------------------------------------

describe('buildTransactionOutcome', () => {
  it('minimal won outcome', () => {
    const r = buildTransactionOutcome('prop-001', 'won')
    expect(r.property_id).toBe('prop-001')
    expect(r.outcome_type).toBe('won')
    expect(r.commission_rate ?? r.negotiation_delta_pct).toBeUndefined()
  })

  it('computes negotiation_delta_pct from prices', () => {
    const r = buildTransactionOutcome('p', 'won', {
      askingPrice: 500_000,
      salePrice:   520_000,
    })
    expect(r.negotiation_delta_pct).toBeCloseTo(4, 1)
  })

  it('computes avm_error_pct from prices', () => {
    const r = buildTransactionOutcome('p', 'won', {
      salePrice:      500_000,
      avmValueAtTime: 550_000,
    })
    expect(r.avm_error_pct).toBeCloseTo(10, 1)
  })

  it('no delta when asking_price missing', () => {
    const r = buildTransactionOutcome('p', 'lost', { salePrice: 500_000 })
    expect(r.negotiation_delta_pct).toBeUndefined()
  })

  it('sets closed_at to now by default', () => {
    const before = Date.now()
    const r      = buildTransactionOutcome('p', 'won')
    const after  = Date.now()
    expect(new Date(r.closed_at!).getTime()).toBeGreaterThanOrEqual(before)
    expect(new Date(r.closed_at!).getTime()).toBeLessThanOrEqual(after)
  })

  it('uses provided closed_at', () => {
    const date = '2026-05-01T12:00:00.000Z'
    const r    = buildTransactionOutcome('p', 'won', { closedAt: date })
    expect(r.closed_at).toBe(date)
  })

  it('sets all optional fields', () => {
    const r = buildTransactionOutcome('p', 'lost', {
      distributionEventId: 'evt-1',
      agentEmail:          'agent@test.com',
      scoreAtTime:         85,
      gradeAtTime:         'A',
      rankAtTime:          1,
      tierAtTime:          'PRIORITY',
      closingFriction:     'financing',
      notes:               'Bank declined',
    })
    expect(r.distribution_event_id).toBe('evt-1')
    expect(r.agent_email).toBe('agent@test.com')
    expect(r.score_at_time).toBe(85)
    expect(r.grade_at_time).toBe('A')
    expect(r.distribution_rank_at_time).toBe(1)
    expect(r.distribution_tier_at_time).toBe('PRIORITY')
    expect(r.closing_friction).toBe('financing')
    expect(r.notes).toBe('Bank declined')
  })
})

// ---------------------------------------------------------------------------
// buildRejectionRecord
// ---------------------------------------------------------------------------

describe('buildRejectionRecord', () => {
  it('builds minimal record', () => {
    const r = buildRejectionRecord('prop-001', 'price')
    expect(r.property_id).toBe('prop-001')
    expect(r.rejection_category).toBe('price')
    expect(r.lost_to_competitor).toBe(false)
  })

  it('lost_to_competitor defaults to false', () => {
    expect(buildRejectionRecord('p', 'other').lost_to_competitor).toBe(false)
  })

  it('sets all optional fields', () => {
    const r = buildRejectionRecord('p', 'competition', {
      recipientEmail:   'buyer@test.com',
      recipientType:    'investor',
      rejectionReason:  'Outbid by €10k',
      lostToCompetitor: true,
      competitorPrice:  510_000,
      scoreAtTime:      80,
      gradeAtTime:      'A',
    })
    expect(r.recipient_email).toBe('buyer@test.com')
    expect(r.recipient_type).toBe('investor')
    expect(r.lost_to_competitor).toBe(true)
    expect(r.competitor_price).toBe(510_000)
    expect(r.score_at_time).toBe(80)
    expect(r.grade_at_time).toBe('A')
  })
})
