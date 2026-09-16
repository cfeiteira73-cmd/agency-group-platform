/**
 * Phase 2C.C1b-AR — Contacts auth reconciliation boundary tests
 *
 * Verifies resolvePortalUser in app/api/contacts/route.ts:
 *   1. No auth (requirePortalAuth fails) → 401
 *   2. Service token → 401 (contacts is user-context; service tokens excluded)
 *   3. NextAuth session → resolves userId, userRole, userEmail from auth()
 *   4. Magic-link + active user → resolves from users table (id, role)
 *   5. Magic-link + inactive user (is_active=false) → 401 (canonical denied)
 *   6. Magic-link + user not found in DB → 401
 *
 * Security invariants confirmed:
 *   - No valid session → FAIL (401)
 *   - Service token → FAIL (contacts are user-context resources)
 *   - Valid NextAuth → PASS (existing behavior preserved)
 *   - Valid magic-link + active user → PASS (the C1b-AR repair)
 *   - is_active === false → FAIL (canonical semantics from auth.ts)
 *   - is_active === null → PASS (canonical semantics: null=active)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoist mutable mock refs so they work inside vi.mock factories ───────────
const mockRequirePortalAuth = vi.hoisted(() => vi.fn())
const mockAuth              = vi.hoisted(() => vi.fn())
const mockDbSingle          = vi.hoisted(() => vi.fn())

// ── Dependency mocks ─────────────────────────────────────────────────────────
vi.mock('@/lib/requirePortalAuth', () => ({
  requirePortalAuth: mockRequirePortalAuth,
  portalAuthGate:    vi.fn(),
}))

vi.mock('@/auth', () => ({
  auth: mockAuth,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockDbSingle,
        }),
      }),
    }),
  })),
}))

// Silence heavy route deps not under test
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({ from: vi.fn() })),
}))
vi.mock('@/lib/trackLearningEvent', () => ({
  default: { contactCreated: vi.fn() },
}))
vi.mock('@/lib/events/producers', () => ({
  emit: { leadCreated: vi.fn() },
}))
vi.mock('@/lib/observability/correlation', () => ({
  getRequestCorrelationId: vi.fn(() => 'test-corr-id'),
}))

import { resolvePortalUser } from '@/app/api/contacts/route'

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/contacts', { method: 'GET' })
}

const AGENT_EMAIL  = 'agent@agencygroup.pt'
const AGENT_ID     = 'uuid-agent-001'
const AGENT_ROLE   = 'agent'

describe('resolvePortalUser — contacts auth reconciliation (C1b-AR)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL     = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY    = 'service-role-key-test'
  })

  // ── 1. No auth → 401 ─────────────────────────────────────────────────────
  it('no valid session → ok:false (401)', async () => {
    mockRequirePortalAuth.mockResolvedValue({
      ok: false,
      error: 'Unauthorized',
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const result = await resolvePortalUser(makeReq())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  // ── 2. Service token → 401 ────────────────────────────────────────────────
  it('service token → ok:false (401) — contacts is user-context', async () => {
    mockRequirePortalAuth.mockResolvedValue({
      ok: true,
      email: 'cron@agencygroup.pt',
      via: 'service_token',
    })

    const result = await resolvePortalUser(makeReq())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  // ── 3. Valid NextAuth session → resolved user ─────────────────────────────
  it('valid NextAuth session → ok:true with id+role from session', async () => {
    mockRequirePortalAuth.mockResolvedValue({
      ok: true,
      email: AGENT_EMAIL,
      via: 'nextauth',
    })
    mockAuth.mockResolvedValue({
      user: { id: AGENT_ID, email: AGENT_EMAIL, role: AGENT_ROLE },
    })

    const result = await resolvePortalUser(makeReq())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.userId).toBe(AGENT_ID)
      expect(result.userRole).toBe(AGENT_ROLE)
      expect(result.userEmail).toBe(AGENT_EMAIL)
    }
  })

  it('NextAuth via but auth() returns null → ok:false (401)', async () => {
    mockRequirePortalAuth.mockResolvedValue({
      ok: true,
      email: AGENT_EMAIL,
      via: 'nextauth',
    })
    mockAuth.mockResolvedValue(null)

    const result = await resolvePortalUser(makeReq())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  // ── 4. Valid magic-link + active user → resolved user ────────────────────
  it('valid magic-link + is_active=true → ok:true with id+role from DB', async () => {
    mockRequirePortalAuth.mockResolvedValue({
      ok: true,
      email: AGENT_EMAIL,
      via: 'magic_link',
    })
    mockDbSingle.mockResolvedValue({
      data: { id: AGENT_ID, role: AGENT_ROLE, is_active: true },
      error: null,
    })

    const result = await resolvePortalUser(makeReq())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.userId).toBe(AGENT_ID)
      expect(result.userRole).toBe(AGENT_ROLE)
      expect(result.userEmail).toBe(AGENT_EMAIL)
    }
  })

  it('valid magic-link + is_active=null → ok:true (null means active, canonical semantics)', async () => {
    mockRequirePortalAuth.mockResolvedValue({
      ok: true,
      email: AGENT_EMAIL,
      via: 'magic_link',
    })
    mockDbSingle.mockResolvedValue({
      data: { id: AGENT_ID, role: AGENT_ROLE, is_active: null },
      error: null,
    })

    const result = await resolvePortalUser(makeReq())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.userId).toBe(AGENT_ID)
  })

  // ── 5. Magic-link + inactive user → 401 ──────────────────────────────────
  it('valid magic-link + is_active=false → ok:false (401, canonical denied)', async () => {
    mockRequirePortalAuth.mockResolvedValue({
      ok: true,
      email: AGENT_EMAIL,
      via: 'magic_link',
    })
    mockDbSingle.mockResolvedValue({
      data: { id: AGENT_ID, role: AGENT_ROLE, is_active: false },
      error: null,
    })

    const result = await resolvePortalUser(makeReq())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  // ── 6. Magic-link + user not in DB → 401 ─────────────────────────────────
  it('valid magic-link + no user row → ok:false (401)', async () => {
    mockRequirePortalAuth.mockResolvedValue({
      ok: true,
      email: AGENT_EMAIL,
      via: 'magic_link',
    })
    mockDbSingle.mockResolvedValue({ data: null, error: null })

    const result = await resolvePortalUser(makeReq())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  // ── Role defaults ─────────────────────────────────────────────────────────
  it('magic-link user with null role → defaults to "agent"', async () => {
    mockRequirePortalAuth.mockResolvedValue({
      ok: true,
      email: AGENT_EMAIL,
      via: 'magic_link',
    })
    mockDbSingle.mockResolvedValue({
      data: { id: AGENT_ID, role: null, is_active: true },
      error: null,
    })

    const result = await resolvePortalUser(makeReq())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.userRole).toBe('agent')
  })

  it('NextAuth user with null role → defaults to "agent"', async () => {
    mockRequirePortalAuth.mockResolvedValue({
      ok: true,
      email: AGENT_EMAIL,
      via: 'nextauth',
    })
    mockAuth.mockResolvedValue({
      user: { id: AGENT_ID, email: AGENT_EMAIL, role: null },
    })

    const result = await resolvePortalUser(makeReq())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.userRole).toBe('agent')
  })
})
