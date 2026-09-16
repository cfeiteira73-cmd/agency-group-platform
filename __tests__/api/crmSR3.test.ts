/**
 * Phase 2C.C1b-SR3 — /api/crm FIX-2 repair: tenant_id removal
 *
 * Proves that after removing stale contacts.tenant_id reference from /api/crm GET:
 *   1. GET query does not reference tenant_id (no 503 from missing column)
 *   2. Unauthenticated GET → 401 (auth gate intact)
 *   3. Contacts query succeeds — returns data, not 'unavailable'
 *   4. Response shape is compatible with PortalCRM expectations
 *   5. Portal magic-link session also accepted (dual-auth preserved)
 *
 * Security invariant:
 *   REMOVE STALE TENANT FILTER ≠ REMOVE AUTH BOUNDARY
 *   Unauthenticated requests remain rejected.
 *   tenant_id was the only query change — auth check unchanged.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted eq-call capture ────────────────────────────────────────────────
const mockEqCalls = vi.hoisted(() => ({ list: [] as Array<{ col: string; val: unknown }> }))

// ── Supabase admin mock (/api/crm uses supabaseAdmin from @/lib/supabase) ──
vi.mock('@/lib/supabase', () => {
  const buildChain = (result: { data: unknown[]; error: null; count: number }) => {
    const chain: Record<string, unknown> = {}
    chain.select   = vi.fn(() => chain)
    chain.order    = vi.fn(() => chain)
    chain.range    = vi.fn(() => chain)
    chain.contains = vi.fn(() => chain)
    chain.or       = vi.fn(() => chain)
    chain.eq = vi.fn((col: string, val: unknown) => {
      mockEqCalls.list.push({ col, val })
      return chain
    })
    chain.then = (resolve: (v: typeof result) => unknown) =>
      Promise.resolve(result).then(resolve)
    return chain
  }

  return {
    supabaseAdmin: {
      from: vi.fn(() =>
        buildChain({
          data: [
            {
              id:                 15,
              full_name:          'Contact A',
              email:              'a@test.pt',
              phone:              '+351 91 000 0001',
              nationality:        'PT',
              budget_min:         300000,
              budget_max:         900000,
              typologies_wanted:  ['T3'],
              preferred_locations: ['Lisboa'],
              tipos:              null,
              zonas:              null,
              status:             'active',
              notes:              null,
              last_contact_at:    '2026-04-25T00:00:00Z',
              next_followup_at:   null,
              source:             'referral',
              lead_score:         80,
              lead_tier:          'A',
              company:            null,
              job_title:          null,
              ai_summary:         '',
              ai_suggested_action: '',
              tags:               [],
              assigned_to:        null,
              agent_id:           null,
              language:           'pt',
              created_at:         '2026-04-01T00:00:00Z',
              updated_at:         '2026-04-25T00:00:00Z',
            },
          ],
          error: null,
          count: 1,
        })
      ),
    },
  }
})

// ── Auth mocks ─────────────────────────────────────────────────────────────
const mockAuth         = vi.hoisted(() => vi.fn())
const mockIsPortalAuth = vi.hoisted(() => vi.fn())

vi.mock('@/auth',           () => ({ auth: mockAuth }))
vi.mock('@/lib/portalAuth', () => ({ isPortalAuth: mockIsPortalAuth }))

// ── Required side-effect stubs ─────────────────────────────────────────────
vi.mock('@/lib/safeCompare',              () => ({ safeCompare: vi.fn(() => false) }))
vi.mock('@/lib/trackLearningEvent',       () => ({ default: { responseReceived: vi.fn(), callBooked: vi.fn() } }))
vi.mock('@/lib/observability/correlation',() => ({ getRequestCorrelationId: vi.fn(() => 'sr3-test-corr') }))
vi.mock('@/lib/requirePortalAuth',        () => ({ requirePortalAuth: vi.fn() }))

// ── Handler under test ─────────────────────────────────────────────────────
import { GET } from '@/app/api/crm/route'

// ── Helpers ────────────────────────────────────────────────────────────────
function makeReq(url: string) {
  return new NextRequest(url, { method: 'GET' })
}

function authNextAuth() {
  mockAuth.mockResolvedValue({ user: { id: 'uuid-user-001', email: 'geral@agencygroup.pt', role: 'agent' } })
  mockIsPortalAuth.mockResolvedValue(false)
}

function authPortalCookie() {
  mockAuth.mockResolvedValue(null)
  mockIsPortalAuth.mockResolvedValue(true)
}

function authFail() {
  mockAuth.mockResolvedValue(null)
  mockIsPortalAuth.mockResolvedValue(false)
}

// ── Tests ──────────────────────────────────────────────────────────────────
describe('C1b-SR3 — tenant_id removed from /api/crm GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEqCalls.list.length = 0
    process.env.NEXT_PUBLIC_SUPABASE_URL  = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-test'
  })

  // 1. No tenant_id filter
  it('GET: no tenant_id .eq() call — stale column removed from query', async () => {
    authNextAuth()
    const res = await GET(makeReq('http://localhost/api/crm'))
    expect(res.status).not.toBe(503)
    const tenantCalls = mockEqCalls.list.filter(c => c.col === 'tenant_id')
    expect(tenantCalls).toHaveLength(0)
  })

  // 2. Auth gate remains intact — unauthenticated rejected
  it('unauthenticated GET → 401 (auth gate intact after repair)', async () => {
    authFail()
    const res = await GET(makeReq('http://localhost/api/crm'))
    expect(res.status).toBe(401)
  })

  // 3. Authenticated GET succeeds — not 503
  it('authenticated GET → 200, source = supabase (not unavailable)', async () => {
    authNextAuth()
    const res = await GET(makeReq('http://localhost/api/crm'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.source).toBe('supabase')
    expect(body.source).not.toBe('unavailable')
  })

  // 4. Response shape compatible with PortalCRM
  it('GET: response has data, count, page, limit, pages, source', async () => {
    authNextAuth()
    const res = await GET(makeReq('http://localhost/api/crm'))
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('count')
    expect(body).toHaveProperty('page')
    expect(body).toHaveProperty('limit')
    expect(body).toHaveProperty('pages')
    expect(body).toHaveProperty('source')
    expect(Array.isArray(body.data)).toBe(true)
  })

  // 5. Mapped contact has PortalCRM-required fields, no tenant_id in output
  it('GET: mapped contact has required fields; tenant_id absent from response', async () => {
    authNextAuth()
    const res = await GET(makeReq('http://localhost/api/crm'))
    const body = await res.json()
    expect(body.data.length).toBeGreaterThan(0)
    const c = body.data[0]
    expect(c).toHaveProperty('id')
    expect(c).toHaveProperty('name')
    expect(c).toHaveProperty('email')
    expect(c).toHaveProperty('budgetMin')
    expect(c).toHaveProperty('budgetMax')
    expect(c).toHaveProperty('zonas')
    expect(c).toHaveProperty('tipos')
    expect(c).toHaveProperty('status')
    expect(c).not.toHaveProperty('tenant_id')
  })

  // 6. Portal magic-link session also accepted
  it('portal magic-link session accepted — dual-auth preserved', async () => {
    authPortalCookie()
    const res = await GET(makeReq('http://localhost/api/crm'))
    expect(res.status).toBe(200)
  })
})
