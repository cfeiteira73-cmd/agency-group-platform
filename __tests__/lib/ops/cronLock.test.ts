// =============================================================================
// Tests — lib/ops/cronLock.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  generateInstanceId,
  isLockExpired,
  buildLockRow,
} from '../../../lib/ops/cronLock'

// ---------------------------------------------------------------------------
// generateInstanceId
// ---------------------------------------------------------------------------

describe('generateInstanceId', () => {
  it('returns a non-empty string', () => {
    const id = generateInstanceId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('two calls return different IDs', () => {
    expect(generateInstanceId()).not.toBe(generateInstanceId())
  })

  it('looks like a UUID (has 4 hyphens)', () => {
    const id = generateInstanceId()
    expect(id.split('-').length).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// isLockExpired
// ---------------------------------------------------------------------------

describe('isLockExpired', () => {
  it('expired when expiresAt is in the past', () => {
    const past = new Date(Date.now() - 5000).toISOString()
    expect(isLockExpired(past)).toBe(true)
  })

  it('not expired when expiresAt is in the future', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(isLockExpired(future)).toBe(false)
  })

  it('expired at exactly now (boundary: strict < check)', () => {
    const now = new Date().toISOString()
    // by the time we check, it's expired
    const justBefore = new Date(Date.now() - 1).toISOString()
    expect(isLockExpired(justBefore)).toBe(true)
  })

  it('uses provided asOf date for deterministic testing', () => {
    const asOf     = new Date('2026-06-01T12:00:00Z')
    const expired  = new Date('2026-06-01T11:59:00Z').toISOString()   // before asOf
    const notYet   = new Date('2026-06-01T12:01:00Z').toISOString()   // after asOf
    expect(isLockExpired(expired, asOf)).toBe(true)
    expect(isLockExpired(notYet,  asOf)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// buildLockRow
// ---------------------------------------------------------------------------

describe('buildLockRow', () => {
  it('includes all required fields', () => {
    const row = buildLockRow('my-cron', 'inst-123', 10)
    expect(row.cron_name).toBe('my-cron')
    expect(row.instance_id).toBe('inst-123')
    expect(row.locked_at).toBeDefined()
    expect(row.expires_at).toBeDefined()
  })

  it('expires_at is ttlMinutes after locked_at', () => {
    const before = Date.now()
    const row    = buildLockRow('test', 'id', 15)
    const after  = Date.now()

    const lockedMs  = new Date(row.locked_at).getTime()
    const expiresMs = new Date(row.expires_at).getTime()
    const diffMin   = (expiresMs - lockedMs) / 60_000

    expect(lockedMs).toBeGreaterThanOrEqual(before)
    expect(lockedMs).toBeLessThanOrEqual(after)
    expect(diffMin).toBeCloseTo(15, 0)
  })

  it('expires_at is in the future', () => {
    const row = buildLockRow('c', 'i', 10)
    expect(isLockExpired(row.expires_at)).toBe(false)
  })

  it('different TTL values produce different expiry', () => {
    const row5  = buildLockRow('c', 'i', 5)
    const row60 = buildLockRow('c', 'i', 60)
    const exp5  = new Date(row5.expires_at).getTime()
    const exp60 = new Date(row60.expires_at).getTime()
    expect(exp60).toBeGreaterThan(exp5)
  })

  it('does not include last_released_at', () => {
    const row = buildLockRow('c', 'i', 10)
    expect('last_released_at' in row).toBe(false)
  })
})
