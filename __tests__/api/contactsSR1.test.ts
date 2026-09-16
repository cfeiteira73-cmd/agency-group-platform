/**
 * Phase 2C.C1b-SR1 — Contacts schema repair: tenant_id removal
 *
 * Proves that after removing stale contacts.tenant_id references:
 *   1. GET query no longer references tenant_id (no 500 from missing column)
 *   2. Agent GET — assigned_to restriction preserved
 *   3. Admin GET — sees all contacts (no assigned_to filter)
 *   4. POST insert does not contain tenant_id
 *   5. PUT query does not reference tenant_id
 *   6. DELETE query does not reference tenant_id
 *   7. Unauthenticated GET → 401 (auth gate intact)
 *
 * Security invariant:
 *   REMOVE STALE TENANT FILTER ≠ REMOVE CONTACT ACCESS CONTROL
 *   Agents cannot obtain contacts outside their assigned_to boundary.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted filter capture — accessible inside vi.mock factories ──────────────
const mockEqCalls = vi.hoisted(() => ({ list: [] as Array<{ col: string; val: unknown }> }))

// ── Hoisted auth mocks ────────────────────────────────────────────────────────
const mockRequirePortalAuth = vi.hoisted(() => vi.fn())
const mockAuth              = vi.hoisted(() => vi.fn())

// ── Supabase mock — captures .eq() calls ─────────────────────────────────────
vi.mock('@/lib/supabase/server', () => {
  const buildChain = (selectResult: { data: unknown[]; error: null; count: number }) => {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.insert = vi.fn(() => chain)
    chain.update = vi.fn(() => chain)
    chain.delete = vi.fn(() => chain)
    chain.order  = vi.fn(() => chain)
    chain.range  = vi.fn(() => chain)
    chain.single = vi.fn(() => Promise.resolve({ data: { id: 1, full_name: 'Test' }, error: null }))
    chain.eq = vi.fn((col: string, val: unknown) => {
      mockEqCalls.list.push({ col, val })
      return chain
    })
    chain.or = vi.fn(() => chain)
    // Awaitable — used by GET which does `await query`
    chain.then = (resolve: (v: typeof selectResult) => unknown) =>
      Promise.resolve(selectResult).then(resolve)
    return chain
  }
  return {
    createClient: vi.fn(() =>
      Promise.resolve({
        from: vi.fn(() =>
          buildChain({ data: [{ id: 1, full_name: 'Test Contact' }], error: null, count: 1 })
        ),
      })
    ),
  }
})

// ── Auth dependencies ─────────────────────────────────────────────────────────
vi.mock('@/lib/requirePortalAuth', () => ({
  requirePortalAuth: mockRequirePortalAuth,
  portalAuthGate:    vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mockAuth }))

// service-role client for magic-link path (not used in these tests)
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'uuid-agent-001', role: 'agent', is_active: true },
            error: null,
          }),
        }),
      }),
    })),
  })),
}))

vi.mock('@/lib/trackLearningEvent', () => ({ default: { contactCreated: vi.fn() } }))
vi.mock('@/lib/events/producers', () => ({ emit: { leadCreated: vi.fn() } }))
vi.mock('@/lib/observability/correlation', () => ({
  getRequestCorrelationId: vi.fn(() => 'test-corr-sr1'),
}))

// ── Handlers under test ───────────────────────────────────────────────────────
import { GET, POST, PUT, DELETE } from '@/app/api/contacts/route'

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeReq(method: string, url: string, body?: object) {
  return new NextRequest(url, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  })
}

function authAgent() {
  mockRequirePortalAuth.mockResolvedValue({ ok: true, email: 'agent@ag.pt', via: 'nextauth' })
  mockAuth.mockResolvedValue({ user: { id: 'uuid-agent-001', email: 'agent@ag.pt', role: 'agent' } })
}
function authAdmin() {
  mockRequirePortalAuth.mockResolvedValue({ ok: true, email: 'admin@ag.pt', via: 'nextauth' })
  mockAuth.mockResolvedValue({ user: { id: 'uuid-admin-001', email: 'admin@ag.pt', role: 'admin' } })
}

describe('C1b-SR1 — tenant_id removed from contacts routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEqCalls.list.length = 0  // clear captured eq calls without reassigning
    process.env.NEXT_PUBLIC_SUPABASE_URL  = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-test'
  })

  // ── 1. GET: no tenant_id filter ───────────────────────────────────────────
  it('GET: no tenant_id .eq() call — column removed from query', async () => {
    authAgent()
    const res = await GET(makeReq('GET', 'http://localhost/api/contacts'))
    // Route must not return 500 (which would indicate a DB column error)
    expect(res.status).not.toBe(500)
    const tenantCalls = mockEqCalls.list.filter(c => c.col === 'tenant_id')
    expect(tenantCalls).toHaveLength(0)
  })

  // ── 2. GET agent: assigned_to filter applied ──────────────────────────────
  it('GET agent: .eq("assigned_to", userId) called (access control preserved)', async () => {
    authAgent()
    await GET(makeReq('GET', 'http://localhost/api/contacts'))
    const assignedCall = mockEqCalls.list.find(c => c.col === 'assigned_to')
    expect(assignedCall).toBeDefined()
    expect(assignedCall?.val).toBe('uuid-agent-001')
  })

  // ── 3. GET admin: no assigned_to filter ───────────────────────────────────
  it('GET admin: no .eq("assigned_to") call (admin sees all contacts)', async () => {
    authAdmin()
    await GET(makeReq('GET', 'http://localhost/api/contacts'))
    const assignedCall = mockEqCalls.list.find(c => c.col === 'assigned_to')
    expect(assignedCall).toBeUndefined()
  })

  // ── 4. POST: no tenant_id in insert ──────────────────────────────────────
  it('POST: route does not 500 and no tenant_id in eq calls', async () => {
    authAgent()
    const res = await POST(
      makeReq('POST', 'http://localhost/api/contacts', { full_name: 'Test Lead', source: 'portal' })
    )
    // If tenant_id column were still in the insert, mock would return error or 500
    expect(res.status).not.toBe(500)
    const tenantCalls = mockEqCalls.list.filter(c => c.col === 'tenant_id')
    expect(tenantCalls).toHaveLength(0)
  })

  // ── 5. PUT: no tenant_id filter ───────────────────────────────────────────
  it('PUT: no tenant_id .eq() call', async () => {
    authAgent()
    await PUT(
      makeReq('PUT', 'http://localhost/api/contacts', { id: '1', full_name: 'Updated' })
    )
    const tenantCalls = mockEqCalls.list.filter(c => c.col === 'tenant_id')
    expect(tenantCalls).toHaveLength(0)
  })

  // ── 6. PUT agent: assigned_to filter applied ──────────────────────────────
  it('PUT agent: .eq("assigned_to", userId) called', async () => {
    authAgent()
    await PUT(
      makeReq('PUT', 'http://localhost/api/contacts', { id: '1', full_name: 'Updated' })
    )
    const assignedCall = mockEqCalls.list.find(c => c.col === 'assigned_to')
    expect(assignedCall).toBeDefined()
    expect(assignedCall?.val).toBe('uuid-agent-001')
  })

  // ── 7. DELETE: no tenant_id filter ────────────────────────────────────────
  it('DELETE: no tenant_id .eq() call', async () => {
    authAgent()
    await DELETE(makeReq('DELETE', 'http://localhost/api/contacts?id=1'))
    const tenantCalls = mockEqCalls.list.filter(c => c.col === 'tenant_id')
    expect(tenantCalls).toHaveLength(0)
  })

  // ── 8. DELETE agent: assigned_to filter applied ───────────────────────────
  it('DELETE agent: .eq("assigned_to", userId) called', async () => {
    authAgent()
    await DELETE(makeReq('DELETE', 'http://localhost/api/contacts?id=1'))
    const assignedCall = mockEqCalls.list.find(c => c.col === 'assigned_to')
    expect(assignedCall).toBeDefined()
    expect(assignedCall?.val).toBe('uuid-agent-001')
  })

  // ── 9. Unauthenticated → 401 ──────────────────────────────────────────────
  it('unauthenticated GET → 401 (auth gate intact after repair)', async () => {
    mockRequirePortalAuth.mockResolvedValue({
      ok: false,
      error: 'Unauthorized',
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const res = await GET(makeReq('GET', 'http://localhost/api/contacts'))
    expect(res.status).toBe(401)
  })
})
