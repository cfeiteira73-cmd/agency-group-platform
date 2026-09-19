// =============================================================================
// Phase 2C.D2-B-AUTH-REPAIR — matches ownership boundary tests
// Tests: Model B gate on PATCH /api/matches/[id] (disclosure + review branches)
//
// Pattern: pure logic — vi.mock for all external dependencies, no DB, no network
// Auth model: service_token → 403, inactive → 403, cross-agent → 403,
//   unassigned+non-admin → 403, owner → pass, admin → pass
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Auth mocks ──────────────────────────────────────────────────────────────

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/requirePortalAuth', () => ({
  portalAuthGate: vi.fn(),
}))

vi.mock('@/lib/auth/commercialAuth', () => ({
  resolveActor: vi.fn(),
  checkMatchOwnership: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient()),
}))

// ── Supabase mock factory ────────────────────────────────────────────────────

let _matchRow: Record<string, unknown> | null = null
let _rpcResult: unknown = null
let _rpcError: unknown = null
let _updateRow: Record<string, unknown> | null = null

function mockSupabaseClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'matches') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: _matchRow, error: _matchRow ? null : { message: 'not found' } }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: _updateRow, error: null }),
              }),
            }),
          }),
        }
      }
      if (table === 'properties') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { is_off_market: false }, error: null }),
            }),
          }),
        }
      }
      if (table === 'activities') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'act-1' }, error: null }),
            }),
          }),
        }
      }
      return {}
    }),
    rpc: vi.fn().mockResolvedValue({ data: _rpcResult, error: _rpcError }),
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

import { portalAuthGate } from '@/lib/requirePortalAuth'
import { resolveActor, checkMatchOwnership } from '@/lib/auth/commercialAuth'

function makeGate(via: 'nextauth' | 'magic_link' | 'service_token', email = 'agent@test.com') {
  return { authed: true, response: undefined as unknown as Response, email, via }
}

function makeRequest(body: Record<string, unknown>, matchId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') {
  return new NextRequest(`http://localhost/api/matches/${matchId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

async function callPatch(body: Record<string, unknown>, matchId?: string) {
  const { PATCH } = await import('@/app/api/matches/[id]/route')
  const req = makeRequest(body, matchId)
  return PATCH(req, { params: Promise.resolve({ id: matchId ?? 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }) })
}

const MATCH_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const CONTACT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('matchesOwnershipBoundary — disclosure branch', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    _matchRow = {
      id: MATCH_ID,
      status: 'reviewed_accepted',
      lead_id: CONTACT_ID,
      property_id: 'prop-1',
      disclosure_status: null,
    }
    _rpcResult = { idempotent: false, match: _matchRow, activity: { id: 'act-1' } }
    _rpcError = null
    _updateRow = null
  })

  it('§36 service_token → 403 (D2-A gate)', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('service_token'))

    const res = await callPatch({ disclosure_status: 'authorized' }, MATCH_ID)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.toLowerCase()).toContain('service token')
  })

  it('§35 inactive user → resolveActor returns 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkMatchOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'inactive@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: false, status: 403, error: 'Agent account inactive — commercial mutations require an active account' })

    const res = await callPatch({ disclosure_status: 'authorized' }, MATCH_ID)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('inactive')
  })

  it('§37 unknown user → resolveActor returns 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'ghost@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: false, status: 403, error: 'Authenticated user not found in public.users — human actor required' })

    const res = await callPatch({ disclosure_status: 'authorized' }, MATCH_ID)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('public.users')
  })

  it('§32 cross-agent: acts on another contact → 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkMatchOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'bob@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: { id: 'bob-id', email: 'bob@test.com', role: 'agent', isAdmin: false } })
    vi.mocked(checkMatchOwnership).mockResolvedValue({ ok: false, status: 403, error: 'Not authorized — this contact belongs to another agent' })

    const res = await callPatch({ disclosure_status: 'authorized' }, MATCH_ID)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('another agent')
  })

  it('§34 unassigned contact + non-admin → 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkMatchOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'agent@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: { id: 'agent-id', email: 'agent@test.com', role: 'agent', isAdmin: false } })
    vi.mocked(checkMatchOwnership).mockResolvedValue({ ok: false, status: 403, error: 'Contact is unassigned — only admin may perform commercial actions on unassigned contacts' })

    const res = await callPatch({ disclosure_status: 'authorized' }, MATCH_ID)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('unassigned')
  })

  it('§31 owner acts on own contact → passes ownership gate (not 403)', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkMatchOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'alice@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: { id: 'alice-id', email: 'alice@test.com', role: 'agent', isAdmin: false } })
    vi.mocked(checkMatchOwnership).mockResolvedValue({ ok: true })
    _rpcResult = { idempotent: false, match: _matchRow, activity: { id: 'act-1' } }

    const res = await callPatch({ disclosure_status: 'authorized' }, MATCH_ID)
    // Ownership gate must NOT be the source of failure — 403 means gate blocked it
    expect(res.status).not.toBe(403)
  })

  it('§33 admin acts on unassigned contact → passes ownership gate (not 403)', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkMatchOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'admin@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: { id: 'admin-id', email: 'admin@test.com', role: 'admin', isAdmin: true } })
    vi.mocked(checkMatchOwnership).mockResolvedValue({ ok: true })

    const res = await callPatch({ disclosure_status: 'authorized' }, MATCH_ID)
    expect(res.status).not.toBe(403)
  })
})

describe('matchesOwnershipBoundary — review branch', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    _matchRow = {
      id: MATCH_ID,
      status: 'pending',
      lead_id: CONTACT_ID,
      notes: null,
    }
    _updateRow = { ..._matchRow, status: 'reviewed_accepted' }
    _rpcResult = null
    _rpcError = null
  })

  it('§36 service_token → 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('service_token'))

    const res = await callPatch({ status: 'reviewed_accepted' }, MATCH_ID)
    expect(res.status).toBe(403)
  })

  it('§35 inactive user → 403 via resolveActor', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'inactive@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: false, status: 403, error: 'Agent account inactive — commercial mutations require an active account' })

    const res = await callPatch({ status: 'reviewed_accepted' }, MATCH_ID)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('inactive')
  })

  it('§32 cross-agent on review → 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkMatchOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'bob@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: { id: 'bob-id', email: 'bob@test.com', role: 'agent', isAdmin: false } })
    vi.mocked(checkMatchOwnership).mockResolvedValue({ ok: false, status: 403, error: 'Not authorized — this contact belongs to another agent' })

    const res = await callPatch({ status: 'reviewed_accepted' }, MATCH_ID)
    expect(res.status).toBe(403)
  })

  it('§34 unassigned contact + non-admin on review → 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkMatchOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'agent@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: { id: 'agent-id', email: 'agent@test.com', role: 'agent', isAdmin: false } })
    vi.mocked(checkMatchOwnership).mockResolvedValue({ ok: false, status: 403, error: 'Contact is unassigned — only admin may perform commercial actions on unassigned contacts' })

    const res = await callPatch({ status: 'reviewed_accepted' }, MATCH_ID)
    expect(res.status).toBe(403)
  })

  it('§31 owner reviews own contact → ownership gate passes (not 403)', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkMatchOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'alice@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: { id: 'alice-id', email: 'alice@test.com', role: 'agent', isAdmin: false } })
    vi.mocked(checkMatchOwnership).mockResolvedValue({ ok: true })

    const res = await callPatch({ status: 'reviewed_accepted' }, MATCH_ID)
    expect(res.status).not.toBe(403)
  })

  it('§33 admin reviews unassigned contact → ownership gate passes (not 403)', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkMatchOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'admin@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: { id: 'admin-id', email: 'admin@test.com', role: 'admin', isAdmin: true } })
    vi.mocked(checkMatchOwnership).mockResolvedValue({ ok: true })

    const res = await callPatch({ status: 'reviewed_accepted' }, MATCH_ID)
    expect(res.status).not.toBe(403)
  })
})
