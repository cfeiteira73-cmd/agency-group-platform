// =============================================================================
// Tests — lib/commercial/revenueAttribution.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  computeCommission,
  computeSplitAmounts,
  buildAttributionRecord,
} from '../../../lib/commercial/revenueAttribution'

// ---------------------------------------------------------------------------
// computeCommission
// ---------------------------------------------------------------------------

describe('computeCommission', () => {
  it('standard 5% commission on €500,000 deal', () => {
    const b = computeCommission(500_000)
    expect(b.sale_price).toBe(500_000)
    expect(b.commission_rate).toBe(0.05)
    expect(b.commission_total).toBe(25_000)
    expect(b.cpcv_amount).toBe(12_500)
    expect(b.escritura_amount).toBe(12_500)
    expect(b.split_pct).toBe(100)
    expect(b.agent_net).toBe(25_000)
  })

  it('CPCV + escritura always sum to commission_total', () => {
    const prices = [100_000, 500_000, 1_250_000, 3_000_000]
    for (const price of prices) {
      const b = computeCommission(price)
      expect(b.cpcv_amount + b.escritura_amount).toBeCloseTo(b.commission_total, 2)
    }
  })

  it('custom commission rate (3%)', () => {
    const b = computeCommission(1_000_000, 0.03)
    expect(b.commission_total).toBe(30_000)
    expect(b.commission_rate).toBe(0.03)
  })

  it('split_pct = 60 reduces agent_net', () => {
    const b = computeCommission(500_000, 0.05, 60)
    expect(b.agent_net).toBeCloseTo(15_000, 2)
    expect(b.split_pct).toBe(60)
  })

  it('split_pct = 100 → agent_net equals commission_total', () => {
    const b = computeCommission(800_000, 0.05, 100)
    expect(b.agent_net).toBe(b.commission_total)
  })

  it('split_pct = 0 → agent_net = 0', () => {
    const b = computeCommission(500_000, 0.05, 0)
    expect(b.agent_net).toBe(0)
  })

  it('luxury deal €3M with 5%', () => {
    const b = computeCommission(3_000_000)
    expect(b.commission_total).toBe(150_000)
    expect(b.cpcv_amount).toBe(75_000)
    expect(b.escritura_amount).toBe(75_000)
  })

  it('returns numeric values (not strings)', () => {
    const b = computeCommission(500_000)
    expect(typeof b.commission_total).toBe('number')
    expect(typeof b.cpcv_amount).toBe('number')
    expect(typeof b.agent_net).toBe('number')
  })
})

// ---------------------------------------------------------------------------
// computeSplitAmounts
// ---------------------------------------------------------------------------

describe('computeSplitAmounts', () => {
  it('50/50 split', () => {
    const { primary, counterpart } = computeSplitAmounts(25_000, 50)
    expect(primary).toBe(12_500)
    expect(counterpart).toBe(12_500)
  })

  it('60/40 split', () => {
    const { primary, counterpart } = computeSplitAmounts(25_000, 60)
    expect(primary).toBe(15_000)
    expect(counterpart).toBe(10_000)
  })

  it('100% to primary', () => {
    const { primary, counterpart } = computeSplitAmounts(25_000, 100)
    expect(primary).toBe(25_000)
    expect(counterpart).toBe(0)
  })

  it('0% to primary', () => {
    const { primary, counterpart } = computeSplitAmounts(25_000, 0)
    expect(primary).toBe(0)
    expect(counterpart).toBe(25_000)
  })

  it('primary + counterpart = commission_total', () => {
    const totals = [10_000, 25_000, 75_000, 150_000]
    const pcts   = [30, 50, 60, 70, 80]
    for (const total of totals) {
      for (const pct of pcts) {
        const { primary, counterpart } = computeSplitAmounts(total, pct)
        expect(primary + counterpart).toBeCloseTo(total, 1)
      }
    }
  })

  it('returns numeric values', () => {
    const { primary, counterpart } = computeSplitAmounts(25_000, 50)
    expect(typeof primary).toBe('number')
    expect(typeof counterpart).toBe('number')
  })
})

// ---------------------------------------------------------------------------
// buildAttributionRecord
// ---------------------------------------------------------------------------

describe('buildAttributionRecord', () => {
  it('builds minimal lost record (no salePrice)', () => {
    const r = buildAttributionRecord('prop-001', 'lost')
    expect(r.property_id).toBe('prop-001')
    expect(r.close_status).toBe('lost')
    expect(r.commission_total).toBeUndefined()
    expect(r.sale_price).toBeUndefined()
    expect(r.commission_rate).toBe(0.05)
  })

  it('builds full won record', () => {
    const r = buildAttributionRecord('prop-002', 'won', {
      salePrice:          750_000,
      agentEmail:         'agent@ag.com',
      investorId:         'inv-001',
      distributionEventId: 'evt-abc',
      attributedSource:   'portal',
      attributedGrade:    'A',
      attributedTier:     'PRIORITY',
      distributionRank:   1,
    })
    expect(r.sale_price).toBe(750_000)
    expect(r.commission_total).toBe(37_500)         // 750k * 5%
    expect(r.agent_email).toBe('agent@ag.com')
    expect(r.investor_id).toBe('inv-001')
    expect(r.distribution_event_id).toBe('evt-abc')
    expect(r.attributed_source).toBe('portal')
    expect(r.attributed_score_grade).toBe('A')
    expect(r.attributed_tier).toBe('PRIORITY')
    expect(r.distribution_rank).toBe(1)
  })

  it('commission_total computed from salePrice at default rate', () => {
    const r = buildAttributionRecord('p', 'won', { salePrice: 1_000_000 })
    expect(r.commission_total).toBe(50_000)
  })

  it('commission_total uses custom commissionRate', () => {
    const r = buildAttributionRecord('p', 'won', { salePrice: 1_000_000, commissionRate: 0.03 })
    expect(r.commission_total).toBe(30_000)
    expect(r.commission_rate).toBe(0.03)
  })

  it('closed_at is provided when given', () => {
    const date = '2026-05-02T10:00:00.000Z'
    const r    = buildAttributionRecord('p', 'won', { closedAt: date })
    expect(r.closed_at).toBe(date)
  })

  it('closed_at defaults to current ISO string when not given', () => {
    const before = Date.now()
    const r      = buildAttributionRecord('p', 'won')
    const after  = Date.now()
    const ts     = new Date(r.closed_at!).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('agent_email and investor_id are optional', () => {
    const r = buildAttributionRecord('p', 'lost')
    expect(r.agent_email).toBeUndefined()
    expect(r.investor_id).toBeUndefined()
  })

  it('property_id is always set', () => {
    const r = buildAttributionRecord('prop-xyz', 'lost')
    expect(r.property_id).toBe('prop-xyz')
  })

  it('lost deal with salePrice still computes commission_total', () => {
    // Edge: lost deal with a known asking price for tracking purposes
    const r = buildAttributionRecord('p', 'lost', { salePrice: 500_000 })
    expect(r.commission_total).toBe(25_000)
    expect(r.close_status).toBe('lost')
  })
})
