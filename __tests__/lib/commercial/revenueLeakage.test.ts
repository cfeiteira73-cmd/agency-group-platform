// =============================================================================
// Tests: lib/commercial/revenueLeakage.ts — pure/offline logic
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase before importing
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: vi.fn() },
}))

import { summariseLeakage, detectRevenueLeakage } from '@/lib/commercial/revenueLeakage'
import type { LeakItem } from '@/lib/commercial/revenueLeakage'
import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockEmptyDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(supabaseAdmin as any).from.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  })
}

function mockDbError() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(supabaseAdmin as any).from.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
  })
}

function makeLeakItem(overrides: Partial<LeakItem> = {}): LeakItem {
  return {
    id:          'test-id-1',
    category:    'HIGH_SCORE_NO_CONTACT',
    severity:    'high',
    lead_name:   'Test Lead',
    score:       75,
    revenue_est: 50000,
    description: 'Score 75 — sem contacto há 3 dias',
    days_stale:  3,
    action:      'Contactar imediatamente',
    detected_at: new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// summariseLeakage
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('summariseLeakage', () => {
  it('returns zeros for empty array', () => {
    const s = summariseLeakage([])
    expect(s.total).toBe(0)
    expect(s.critical).toBe(0)
    expect(s.high).toBe(0)
    expect(s.medium).toBe(0)
    expect(s.estimated_revenue).toBe(0)
    expect(s.top_items).toHaveLength(0)
  })

  it('counts by severity correctly', () => {
    const items: LeakItem[] = [
      makeLeakItem({ id: '1', severity: 'critical' }),
      makeLeakItem({ id: '2', severity: 'critical' }),
      makeLeakItem({ id: '3', severity: 'high' }),
      makeLeakItem({ id: '4', severity: 'medium' }),
    ]
    const s = summariseLeakage(items)
    expect(s.total).toBe(4)
    expect(s.critical).toBe(2)
    expect(s.high).toBe(1)
    expect(s.medium).toBe(1)
  })

  it('sums estimated_revenue correctly', () => {
    const items: LeakItem[] = [
      makeLeakItem({ id: '1', revenue_est: 10000 }),
      makeLeakItem({ id: '2', revenue_est: 20000 }),
      makeLeakItem({ id: '3', revenue_est: null }),
    ]
    const s = summariseLeakage(items)
    expect(s.estimated_revenue).toBe(30000)
  })

  it('caps top_items at 10', () => {
    const items = Array.from({ length: 15 }, (_, i) => makeLeakItem({ id: String(i) }))
    const s = summariseLeakage(items)
    expect(s.top_items).toHaveLength(10)
  })

  it('counts by category', () => {
    const items: LeakItem[] = [
      makeLeakItem({ id: '1', category: 'HIGH_SCORE_NO_CONTACT' }),
      makeLeakItem({ id: '2', category: 'HIGH_SCORE_NO_CONTACT' }),
      makeLeakItem({ id: '3', category: 'DEAL_STUCK' }),
      makeLeakItem({ id: '4', category: 'CPCV_READY_NO_ACTION' }),
    ]
    const s = summariseLeakage(items)
    expect(s.by_category.HIGH_SCORE_NO_CONTACT).toBe(2)
    expect(s.by_category.DEAL_STUCK).toBe(1)
    expect(s.by_category.CPCV_READY_NO_ACTION).toBe(1)
  })

  it('includes generated_at timestamp', () => {
    const s = summariseLeakage([])
    expect(typeof s.generated_at).toBe('string')
    expect(new Date(s.generated_at).getTime()).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// detectRevenueLeakage — DB unavailable → graceful empty result
// ---------------------------------------------------------------------------

describe('detectRevenueLeakage — DB error resilience', () => {
  it('returns empty array when DB errors (non-blocking)', async () => {
    mockDbError()
    const items = await detectRevenueLeakage()
    expect(Array.isArray(items)).toBe(true)
    expect(items).toHaveLength(0)
  })

  it('returns empty array when DB returns empty data', async () => {
    mockEmptyDb()
    const items = await detectRevenueLeakage()
    expect(Array.isArray(items)).toBe(true)
    expect(items).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Severity sorting
// ---------------------------------------------------------------------------

describe('summariseLeakage — severity ordering', () => {
  it('top_items preserves critical-first order', () => {
    const items: LeakItem[] = [
      makeLeakItem({ id: '1', severity: 'medium',   revenue_est: 100000 }),
      makeLeakItem({ id: '2', severity: 'critical',  revenue_est: 10000 }),
      makeLeakItem({ id: '3', severity: 'high',      revenue_est: 50000 }),
    ]
    // detectRevenueLeakage sorts before returning; summariseLeakage takes already-sorted input
    // Verify that summariseLeakage correctly slices first 10
    const sorted = [...items].sort((a, b) => {
      const order: Record<string, number> = { critical: 3, high: 2, medium: 1 }
      return order[b.severity] - order[a.severity]
    })
    const s = summariseLeakage(sorted)
    expect(s.top_items[0].severity).toBe('critical')
    expect(s.top_items[1].severity).toBe('high')
    expect(s.top_items[2].severity).toBe('medium')
  })
})
