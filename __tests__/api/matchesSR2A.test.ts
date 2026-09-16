/**
 * Phase 2C.C1b-SR2A — Matches schema repair: tenant_id removal
 *
 * Proves that after removing stale matches.tenant_id references:
 *   1. GET query does not reference tenant_id (no 500 from missing column)
 *   2. Unauthenticated GET → 401 (auth gate intact)
 *   3. lead_id filter still applied when provided
 *   4. status filter still applied when provided
 *   5. No tenant_id .eq() call in any path
 *   6. Response shape includes matches, total, page, limit
 *
 * Security invariant:
 *   REMOVE STALE TENANT FILTER ≠ REMOVE AUTH BOUNDARY
 *   portalAuthGate remains the auth boundary; only the nonexistent
 *   tenant_id column filter was removed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted eq-call capture ────────────────────────────────────────────────
const mockEqCalls = vi.hoisted(() => ({ list: [] as Array<{ col: string; val: unknown }> }))

// ── Hoisted auth mock ──────────────────────────────────────────────────────
const mockPortalAuthGate = vi.hoisted(() => vi.fn())

// ── Supabase mock (matches route uses createClient from @supabase/supabase-js) ─
vi.mock('@supabase/supabase-js', () => {
  const buildChain = (result: { data: unknown[]; error: null; count: number }) => {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.order  = vi.fn(() => chain)
    chain.range  = vi.fn(() => chain)
    chain.eq = vi.fn((col: string, val: unknown) => {
      mockEqCalls.list.push({ col, val })
      return chain
    })
    chain.then = (resolve: (v: typeof result) => unknown) =>
      Promise.resolve(result).then(resolve)
    return chain
  }

  return {
    createClient: vi.fn(() => ({
      from: vi.fn(() =>
        buildChain({
          data: [
            {
              id:               'uuid-match-001',
              lead_id:          15,
              property_id:      '1003',
              property_title:   'Apartamento Lisboa',
              match_score:      82,
              match_reasons:    ['budget_fit', 'location_match'],
              explanation:      'Strong location and budget alignment',
              similarity:       0.91,
              estimated_yield:  0.045,
              status:           'pending',
              matched_by:       'v1-engine',
              created_at:       '2026-09-01T10:00:00Z',
              updated_at:       '2026-09-01T10:00:00Z',
            },
          ],
          error: null,
          count: 1,
        })
      ),
    })),
  }
})

// ── Auth mock ──────────────────────────────────────────────────────────────
vi.mock('@/lib/requirePortalAuth', () => ({
  portalAuthGate: mockPortalAuthGate,
  requirePortalAuth: vi.fn(),
}))

// ── Handler under test ─────────────────────────────────────────────────────
import { GET } from '@/app/api/matches/route'

// ── Helpers ────────────────────────────────────────────────────────────────
function makeReq(url: string) {
  return new NextRequest(url, { method: 'GET' })
}

function authOk() {
  mockPortalAuthGate.mockResolvedValue({ authed: true, email: 'agent@ag.pt', via: 'nextauth' })
}
function authFail() {
  mockPortalAuthGate.mockResolvedValue({
    authed: false,
    response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────
describe('C1b-SR2A — tenant_id removed from matches route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEqCalls.list.length = 0
    process.env.NEXT_PUBLIC_SUPABASE_URL  = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-test'
  })

  // 1. No tenant_id filter
  it('GET: no tenant_id .eq() call — stale column removed from query', async () => {
    authOk()
    const res = await GET(makeReq('http://localhost/api/matches'))
    expect(res.status).not.toBe(500)
    const tenantCalls = mockEqCalls.list.filter(c => c.col === 'tenant_id')
    expect(tenantCalls).toHaveLength(0)
  })

  // 2. Auth gate still rejects unauthenticated
  it('unauthenticated GET → 401 (auth gate intact after repair)', async () => {
    authFail()
    const res = await GET(makeReq('http://localhost/api/matches'))
    expect(res.status).toBe(401)
  })

  // 3. lead_id filter still applied
  it('GET with lead_id: .eq("lead_id", ...) is called', async () => {
    authOk()
    await GET(makeReq('http://localhost/api/matches?lead_id=15'))
    const leadCall = mockEqCalls.list.find(c => c.col === 'lead_id')
    expect(leadCall).toBeDefined()
    expect(leadCall?.val).toBe('15')
  })

  // 4. status filter still applied
  it('GET with status: .eq("status", ...) is called', async () => {
    authOk()
    await GET(makeReq('http://localhost/api/matches?status=interested'))
    const statusCall = mockEqCalls.list.find(c => c.col === 'status')
    expect(statusCall).toBeDefined()
    expect(statusCall?.val).toBe('interested')
  })

  // 5. No extra eq calls on legitimate filter paths
  it('GET with lead_id and status: no tenant_id call in combined filter', async () => {
    authOk()
    await GET(makeReq('http://localhost/api/matches?lead_id=15&status=pending'))
    const tenantCalls = mockEqCalls.list.filter(c => c.col === 'tenant_id')
    expect(tenantCalls).toHaveLength(0)
    // Both legitimate filters present
    expect(mockEqCalls.list.find(c => c.col === 'lead_id')).toBeDefined()
    expect(mockEqCalls.list.find(c => c.col === 'status')).toBeDefined()
  })

  // 6. Response shape
  it('GET: response includes matches, total, page, limit', async () => {
    authOk()
    const res = await GET(makeReq('http://localhost/api/matches'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('matches')
    expect(body).toHaveProperty('total')
    expect(body).toHaveProperty('page')
    expect(body).toHaveProperty('limit')
    expect(Array.isArray(body.matches)).toBe(true)
  })

  // 7. Match serialization — key fields present
  it('GET: match record includes expected fields (no tenant_id in response)', async () => {
    authOk()
    const res = await GET(makeReq('http://localhost/api/matches'))
    const body = await res.json()
    expect(body.matches.length).toBeGreaterThan(0)
    const m = body.matches[0]
    expect(m).toHaveProperty('id')
    expect(m).toHaveProperty('lead_id')
    expect(m).toHaveProperty('property_id')
    expect(m).toHaveProperty('match_score')
    expect(m).not.toHaveProperty('tenant_id')
  })
})
