/**
 * Google OAuth signIn boundary tests — D1 Foundation Hardening
 *
 * Verifies that the authorizeGoogleUser helper in auth.ts correctly enforces
 * the canonical is_active semantics for Google OAuth sign-in:
 *
 *   - Unknown user (not in DB)  → denied  (no auto-provisioning)
 *   - is_active === false        → denied
 *   - is_active === null         → allowed (NULL = active, canonical across all auth paths)
 *   - is_active === true         → allowed
 *
 * These semantics must remain consistent with:
 *   - Credentials authorize()   in auth.ts
 *   - magic-link getAnySession() in lib/auth/getSession.ts
 *
 * Historical finding: the signIn callback comment previously said
 * "is_active = true" but the code correctly allows NULL too. This test
 * suite is the canonical regression guard for that invariant.
 */

import { describe, it, expect } from 'vitest'

// NextAuth imports require next/server which isn't available in vitest;
// we only test the exported pure helper, not the NextAuth configuration.
vi.mock('next-auth', () => ({
  default: vi.fn().mockReturnValue({
    handlers: {},
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}))
vi.mock('next-auth/providers/google', () => ({ default: vi.fn() }))
vi.mock('next-auth/providers/credentials', () => ({ default: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: vi.fn() }),
      }),
    }),
  }),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('bcryptjs', () => ({ compareSync: vi.fn() }))
vi.mock('otpauth', () => ({ TOTP: vi.fn(), Secret: { fromBase32: vi.fn() } }))

import { authorizeGoogleUser } from '@/auth'

describe('authorizeGoogleUser — Google OAuth is_active boundary (D1)', () => {
  it('allows an active user (is_active = true)', () => {
    expect(authorizeGoogleUser({ is_active: true })).toBe(true)
  })

  it('allows a user with null is_active — canonical: NULL treated as active', () => {
    // NULL means "not explicitly deactivated" — same semantics as
    // Credentials authorize() and magic-link getAnySession()
    expect(authorizeGoogleUser({ is_active: null })).toBe(true)
  })

  it('denies an explicitly deactivated user (is_active = false)', () => {
    expect(authorizeGoogleUser({ is_active: false })).toBe(false)
  })

  it('denies an unknown user (null) — no auto-provisioning', () => {
    // Any Google account not in public.users is denied.
    // This prevents arbitrary Google accounts from accessing the CRM.
    expect(authorizeGoogleUser(null)).toBe(false)
  })

  it('cross-auth-system invariant: semantics match Credentials and magic-link is_active gate', () => {
    // All three auth paths enforce: only is_active === false denies access.
    // NULL and true both permit. Unknown user (null existing) always denies.
    // This test documents the invariant that must hold across auth systems.
    expect(authorizeGoogleUser({ is_active: false })).toBe(false)  // explicitly inactive
    expect(authorizeGoogleUser({ is_active: true })).toBe(true)    // explicitly active
    expect(authorizeGoogleUser({ is_active: null })).toBe(true)    // null = active
    expect(authorizeGoogleUser(null)).toBe(false)                   // not in DB
  })
})
