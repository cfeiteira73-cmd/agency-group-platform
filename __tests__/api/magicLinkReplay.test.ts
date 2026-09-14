/**
 * Magic-link replay protection boundary tests — D2 Foundation Hardening
 *
 * Verifies that classifyInsertError in app/api/auth/verify/route.ts:
 *   1. Returns null on no error (success path)
 *   2. Returns 401 on 23505 (duplicate — already used)
 *   3. Returns 500 on 42P01 (table missing) — D2 FIX: was previously fail-open
 *   4. Returns 500 on any other DB error
 *
 * Security invariant: if the replay-protection table is absent (42P01),
 * authentication MUST fail closed. A token that cannot be recorded as
 * consumed must never be treated as consumable — doing so enables replay.
 *
 * Historical finding: before D2 hardening, 42P01 was silently ignored
 * (fail-open), allowing a token to be reused indefinitely if the
 * used_magic_tokens table were accidentally dropped.
 */

import { describe, it, expect, vi } from 'vitest'

// The verify route imports supabaseAdmin (even though classifyInsertError is pure).
// Mock it so the module can load without NEXT_PUBLIC_SUPABASE_URL being set.
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: vi.fn() } }))
vi.mock('@/lib/logger', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

import { classifyInsertError } from '@/app/api/auth/verify/route'

describe('classifyInsertError — replay protection error classification (D2)', () => {
  it('null error → null (success path: token not previously seen)', () => {
    expect(classifyInsertError(null)).toBeNull()
  })

  it('undefined error → null (success path)', () => {
    expect(classifyInsertError(undefined)).toBeNull()
  })

  it('23505 (duplicate key) → 401 — token already consumed', () => {
    const result = classifyInsertError({ code: '23505', message: 'duplicate key' })
    expect(result).not.toBeNull()
    expect(result?.status).toBe(401)
  })

  it('42P01 (table missing) → 500 fail-closed — D2 regression test', () => {
    // BEFORE hardening: 42P01 was ignored → session issued → token replayable
    // AFTER hardening: 42P01 returns 500 → no session → fail-closed
    const result = classifyInsertError({
      code: '42P01',
      message: 'relation "used_magic_tokens" does not exist',
    })
    expect(result).not.toBeNull()
    expect(result?.status).toBe(500)
  })

  it('generic DB error → 500 fail-closed', () => {
    const result = classifyInsertError({ code: 'PGRST301', message: 'connection error' })
    expect(result).not.toBeNull()
    expect(result?.status).toBe(500)
  })

  it('unknown error code → 500 (default fail-closed)', () => {
    const result = classifyInsertError({ code: 'UNKNOWN_CODE' })
    expect(result).not.toBeNull()
    expect(result?.status).toBe(500)
  })

  it('42P01 status is 500, not 401 — missing table is an infra error not a user error', () => {
    // 401 would imply the token is invalid (wrong for an infra failure)
    // 500 correctly signals that the system cannot safely process the request
    const result = classifyInsertError({ code: '42P01' })
    expect(result?.status).not.toBe(401)
    expect(result?.status).toBe(500)
  })
})
