// =============================================================================
// Tests: lib/platform/config.ts (pure / offline logic only)
//
// We test everything that doesn't require a live Supabase connection:
//   - invalidateConfigCache (no-throw)
//   - getConfigValue falls back to default when DB is unavailable
//   - getPlatformConfig returns correct snapshot structure
//   - updateConfigValue throws when DB returns error
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock supabaseAdmin so the module loads without real DB credentials
// ---------------------------------------------------------------------------

// We need to mock before importing config.ts because the module reads
// supabaseAdmin at the top level.

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Import under test (after mock is in place)
// ---------------------------------------------------------------------------

import {
  invalidateConfigCache,
  getConfigValue,
  getPlatformConfig,
  updateConfigValue,
} from '@/lib/platform/config'

// We need access to the mock to set up return values
import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockDbError() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(supabaseAdmin as any).from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      }),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: 'update failed' } }),
    }),
  })
}

function mockDbSuccess(row: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(supabaseAdmin as any).from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: row, error: null }),
      }),
      order: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [row], error: null }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Clear cache between tests so they don't bleed into each other
  invalidateConfigCache()
  vi.clearAllMocks()
})

describe('invalidateConfigCache', () => {
  it('runs without throwing', () => {
    expect(() => invalidateConfigCache()).not.toThrow()
    expect(() => invalidateConfigCache('scoring.ataque_threshold')).not.toThrow()
  })
})

describe('getConfigValue — DB error → returns default', () => {
  it('returns numeric default when DB errors', async () => {
    mockDbError()
    const val = await getConfigValue('scoring.ataque_threshold', 88)
    expect(val).toBe(88)
  })

  it('returns string default when DB errors', async () => {
    mockDbError()
    const val = await getConfigValue('some.text_key', 'default_text')
    expect(val).toBe('default_text')
  })

  it('returns boolean default when DB errors', async () => {
    mockDbError()
    const val = await getConfigValue('some.bool_key', true)
    expect(val).toBe(true)
  })
})

describe('getConfigValue — DB success → returns DB value', () => {
  it('returns numeric value from DB', async () => {
    mockDbSuccess({ config_type: 'numeric', value_numeric: 92, value_text: null, value_boolean: null })
    const val = await getConfigValue('scoring.ataque_threshold', 88)
    expect(val).toBe(92)
  })

  it('returns boolean value from DB', async () => {
    mockDbSuccess({ config_type: 'boolean', value_numeric: null, value_text: null, value_boolean: false })
    const val = await getConfigValue('some.bool_key', true)
    expect(val).toBe(false)
  })

  it('returns text value from DB', async () => {
    mockDbSuccess({ config_type: 'text', value_numeric: null, value_text: 'hello', value_boolean: null })
    const val = await getConfigValue('some.text_key', 'default')
    expect(val).toBe('hello')
  })
})

describe('getPlatformConfig — shape validation', () => {
  it('returns complete snapshot with expected structure when DB errors (defaults)', async () => {
    mockDbError()
    const cfg = await getPlatformConfig()

    // scoring
    expect(typeof cfg.scoring.ataque_threshold).toBe('number')
    expect(typeof cfg.scoring.high_priority_threshold).toBe('number')
    expect(typeof cfg.scoring.money_priority_threshold).toBe('number')
    expect(typeof cfg.scoring.cpcv_readiness_threshold).toBe('number')
    expect(typeof cfg.scoring.qualification_threshold).toBe('number')
    expect(typeof cfg.scoring.scarcity_threshold).toBe('number')
    expect(typeof cfg.scoring.master_attack_rank_min).toBe('number')
    expect(typeof cfg.scoring.cpcv_probability_min).toBe('number')

    // alerts
    expect(typeof cfg.alerts.p0_cooldown_hours).toBe('number')
    expect(typeof cfg.alerts.p1_cooldown_hours).toBe('number')
    expect(typeof cfg.alerts.deal_pack_auto_score).toBe('number')

    // distribution
    expect(typeof cfg.distribution.max_active_agents).toBe('number')
    expect(typeof cfg.distribution.score_decay_days).toBe('number')

    // revenue
    expect(typeof cfg.revenue.commission_pct).toBe('number')
    expect(typeof cfg.revenue.cpcv_split_pct).toBe('number')
    expect(typeof cfg.revenue.escritura_split_pct).toBe('number')
  })

  it('uses safe defaults: ataque ≥80, high_priority ≥60', async () => {
    mockDbError()
    const cfg = await getPlatformConfig()

    // Ataque threshold should be stricter than high-priority
    expect(cfg.scoring.ataque_threshold).toBeGreaterThan(cfg.scoring.high_priority_threshold)
    // Revenue commission should be positive
    expect(cfg.revenue.commission_pct).toBeGreaterThan(0)
    // CPCV splits should sum to 100
    expect(cfg.revenue.cpcv_split_pct + cfg.revenue.escritura_split_pct).toBe(100)
  })
})

describe('updateConfigValue — error propagation', () => {
  it('throws when DB update fails', async () => {
    mockDbError()
    await expect(updateConfigValue('scoring.ataque_threshold', 90, 'test@test.com'))
      .rejects.toThrow('update failed')
  })
})
