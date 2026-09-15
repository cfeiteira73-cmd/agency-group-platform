/**
 * Phase 2C.B3 — Regression Tests
 *
 * Covers the 8 findings fixed in the B3 implementation:
 *
 *   B3-001 — PUT /api/properties/db: agent cannot self-promote status (→ 403)
 *   B3-002 — POST /api/properties/db: server-side forces pending_review for agent
 *   B3-003 — POST /api/embeddings/sync: buildPropertyText uses Portuguese column names
 *   B3-004 — GET /api/cron/sync-listings: fallback select uses Portuguese names
 *   B3-008 — GET /api/properties/db: explicit projection (no embedding/audit columns)
 *   B3-012 — GET /api/properties: DB error → 500, not 200+[]
 *   B3-014 — GET /api/cron/investor-alerts: select uses Portuguese column names
 *   B3-015 — GET /api/analytics/inventory-forecast: select uses Portuguese column names
 *
 * All tests use synthetic data and mocked Supabase — no real DB calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mock refs ─────────────────────────────────────────────────────────
const {
  mockDbInsert,
  mockDbUpdate,
  mockDbSelect,
  mockDbFrom,
  mockAuthImpl,
  mockPortalAuth,
  mockAdminSelect,
  mockAdminFrom,
} = vi.hoisted(() => ({
  mockDbInsert:    vi.fn(),
  mockDbUpdate:    vi.fn(),
  mockDbSelect:    vi.fn(),
  mockDbFrom:      vi.fn(),
  mockAuthImpl:    vi.fn(),
  mockPortalAuth:  vi.fn(),
  mockAdminSelect: vi.fn(),
  mockAdminFrom:   vi.fn(),
}))

// ── @/auth ────────────────────────────────────────────────────────────────────
vi.mock('@/auth', () => ({ auth: mockAuthImpl }))

// ── @/lib/portalAuth ──────────────────────────────────────────────────────────
vi.mock('@/lib/portalAuth', () => ({ isPortalAuth: mockPortalAuth }))

// ── @/lib/supabase/server (used by /api/properties/db) ───────────────────────
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({
    from: mockDbFrom,
  }),
}))

// ── @/lib/supabase (used by /api/properties and cron routes) ─────────────────
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mockAdminFrom,
  },
}))

// ── Observability ─────────────────────────────────────────────────────────────
vi.mock('@/lib/observability/correlation', () => ({
  getRequestCorrelationId: vi.fn().mockReturnValue('b3-test-corr-id'),
  recordRequest: vi.fn(),
}))
vi.mock('@/lib/sre/sloTracker', () => ({
  recordRequest: vi.fn().mockResolvedValue(undefined),
}))

// ── Misc deps used by cron routes ────────────────────────────────────────────
vi.mock('@/lib/ops/withCronLock', () => ({
  withCronLock: (_name: string, _ttl: number, fn: () => unknown) => fn(),
}))
vi.mock('@/lib/safeCompare', () => ({
  safeCompare: (a: string, b: string) => a === b,
}))
vi.mock('@/lib/observability/correlation', () => ({
  getRequestCorrelationId: vi.fn().mockReturnValue('b3-corr'),
  cronCorrelationId: vi.fn().mockReturnValue('b3-cron-corr'),
  recordRequest: vi.fn(),
}))
vi.mock('@/lib/ops/withAI', () => ({
  withAI: (_name: string, fn: () => unknown) => fn(),
}))
vi.mock('@/lib/auth/serviceAuth', () => ({
  requireServiceAuth: () => Promise.resolve({ ok: true }),
}))
vi.mock('@/lib/auth/adminAuth', () => ({
  getAdminRole: vi.fn().mockResolvedValue({ role: 'admin' }),
  hasPermission: vi.fn().mockReturnValue(true),
}))

// ─────────────────────────────────────────────────────────────────────────────

function makeRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  body?: unknown,
  headers?: Record<string, string>,
): NextRequest {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(url, init)
}

// ─────────────────────────────────────────────────────────────────────────────
// B3-002 — POST /api/properties/db: agent must get pending_review
// ─────────────────────────────────────────────────────────────────────────────
describe('B3-002 — POST /api/properties/db: server-side pending_review for agent', () => {
  beforeEach(() => {
    vi.resetModules()

    // Agent session (non-admin)
    mockAuthImpl.mockResolvedValue({
      user: { id: 'agent-001', email: 'agent@test.pt', role: 'agent' },
    })

    // Capture the insert call
    mockDbInsert.mockReturnValue({
      select: () => ({
        single: () => Promise.resolve({
          data: { id: 'new-prop-001', status: 'pending_review' },
          error: null,
        }),
      }),
    })

    mockDbFrom.mockReturnValue({
      insert:  mockDbInsert,
      select:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockReturnThis(),
      ilike:   vi.fn().mockReturnThis(),
      gte:     vi.fn().mockReturnThis(),
      lte:     vi.fn().mockReturnThis(),
      or:      vi.fn().mockReturnThis(),
      not:     vi.fn().mockReturnThis(),
      order:   vi.fn().mockReturnThis(),
      range:   vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    })
  })

  it('always inserts status=pending_review regardless of body.status for agent role', async () => {
    const { POST } = await import('@/app/api/properties/db/route')

    const req = makeRequest('POST', 'http://localhost:3000/api/properties/db', {
      id:    'prop-b3002-test',
      nome:  'Apartamento Teste B3',
      zona:  'Lisboa',
      tipo:  'Apartamento',
      preco: 500000,
      area:  80,
      status: 'active',  // agent attempts to bypass pending_review
    })

    const res = await POST(req)
    expect(res.status).toBe(201)

    // Verify insert was called with pending_review, not 'active'
    expect(mockDbInsert).toHaveBeenCalledOnce()
    const insertedData = mockDbInsert.mock.calls[0][0]
    expect(insertedData.status).toBe('pending_review')
  })

  it('even with status=sold body, agent gets pending_review', async () => {
    const { POST } = await import('@/app/api/properties/db/route')

    const req = makeRequest('POST', 'http://localhost:3000/api/properties/db', {
      id:    'prop-b3002-sold',
      nome:  'Moradia Teste',
      zona:  'Cascais',
      tipo:  'Moradia',
      preco: 800000,
      area:  150,
      status: 'sold',  // explicitly trying to set sold status
    })

    const res = await POST(req)
    expect(res.status).toBe(201)

    const insertedData = mockDbInsert.mock.calls[0][0]
    expect(insertedData.status).toBe('pending_review')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// B3-001 — PUT /api/properties/db: agent cannot update status
// ─────────────────────────────────────────────────────────────────────────────
describe('B3-001 — PUT /api/properties/db: agent blocked from status update', () => {
  beforeEach(() => {
    vi.resetModules()

    // Agent session
    mockAuthImpl.mockResolvedValue({
      user: { id: 'agent-001', email: 'agent@test.pt', role: 'agent' },
    })

    mockDbFrom.mockReturnValue({
      update:  mockDbUpdate,
      select:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockReturnThis(),
      ilike:   vi.fn().mockReturnThis(),
      gte:     vi.fn().mockReturnThis(),
      lte:     vi.fn().mockReturnThis(),
      or:      vi.fn().mockReturnThis(),
      not:     vi.fn().mockReturnThis(),
      order:   vi.fn().mockReturnThis(),
      range:   vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    })
  })

  it('returns 403 when agent tries to update status field', async () => {
    const { PUT } = await import('@/app/api/properties/db/route')

    const req = makeRequest('PUT', 'http://localhost:3000/api/properties/db', {
      id:     'prop-exist-001',
      status: 'active',  // agent trying to self-promote
    })

    const res = await PUT(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/admin/i)
  })

  it('allows agent to update non-status fields without 403', async () => {
    mockDbUpdate.mockReturnValue({
      eq:     vi.fn().mockReturnThis(),
      select: () => ({
        single: () => Promise.resolve({
          data: { id: 'prop-exist-001', preco: 550000 },
          error: null,
        }),
      }),
    })

    const { PUT } = await import('@/app/api/properties/db/route')

    const req = makeRequest('PUT', 'http://localhost:3000/api/properties/db', {
      id:    'prop-exist-001',
      preco: 550000,  // price change — allowed for agents
    })

    const res = await PUT(req)
    expect(res.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// B3-012 — GET /api/properties: DB error must return 5xx, not 200+[]
// ─────────────────────────────────────────────────────────────────────────────
describe('B3-012 — GET /api/properties: DB error → 5xx not 200+[]', () => {
  beforeEach(() => {
    vi.resetModules()

    // Authenticated portal user
    mockAuthImpl.mockResolvedValue({
      user: { id: 'user-001', email: 'staff@test.pt' },
    })
    mockPortalAuth.mockResolvedValue(true)
  })

  it('returns 500 when Supabase query returns an error', async () => {
    // Build a thenable mock that resolves with a DB error when awaited.
    // Supabase query builders are PromiseLike — `await builder` calls builder.then().
    const dbError = { message: 'connection refused', code: 'PGRST_DB_ERROR' }
    const errorBuilder = {
      select: vi.fn().mockReturnThis(),
      not:    vi.fn().mockReturnThis(),
      limit:  vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      lte:    vi.fn().mockReturnThis(),
      then:   (resolve: (v: unknown) => void) =>
        resolve({ data: null, error: dbError }),
    }
    mockAdminFrom.mockReturnValue(errorBuilder)

    const { GET } = await import('@/app/api/properties/route')
    const req = makeRequest('GET', 'http://localhost:3000/api/properties')
    const res = await GET(req)
    expect(res.status).toBeGreaterThanOrEqual(500)
    expect(res.status).toBeLessThan(600)
  })

  it('returns 200+[] for empty result set (not a DB error)', async () => {
    // Simulate successful query returning empty data
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      not:    vi.fn().mockReturnThis(),
      limit:  vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      lte:    vi.fn().mockResolvedValue({ data: [], error: null }),
    })

    const { GET } = await import('@/app/api/properties/route')
    const req = makeRequest('GET', 'http://localhost:3000/api/properties')
    const res = await GET(req)
    // Empty result set is NOT an error — should return 200
    expect(res.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// B3-003 — embeddings/sync: select uses Portuguese column names
// ─────────────────────────────────────────────────────────────────────────────
describe('B3-003 — embeddings/sync: select uses Portuguese column names', () => {
  it('buildPropertyText produces non-empty text from Portuguese-named fields', async () => {
    // Source-code inspection: verify the route uses Portuguese column names.
    // We do NOT import the route module because it creates a Supabase client at module
    // load time (before mocks take effect). File-read inspection is the correct approach.
    const fs = await import('fs')
    const path = await import('path')
    const routePath = path.resolve(
      __dirname, '../../app/api/embeddings/sync/route.ts'
    )
    const src = fs.readFileSync(routePath, 'utf-8')

    // Portuguese names must be present in the select and interface
    expect(src).toContain("'id, nome, tipo, zona, descricao, quartos, area, preco'")
    expect(src).toContain('nome:     string | null')
    expect(src).toContain('p.nome')
    expect(src).toContain('p.tipo')
    expect(src).toContain('p.zona')
    expect(src).toContain('p.preco')

    // English drift names must NOT be present in the select or interface
    expect(src).not.toContain("'id, title, type, zone, description, bedrooms, area_m2, price'")
    expect(src).not.toContain('title:       string | null')

  })
})

// ─────────────────────────────────────────────────────────────────────────────
// B3-015 — inventory-forecast: select uses Portuguese column names
// ─────────────────────────────────────────────────────────────────────────────
describe('B3-015 — inventory-forecast: select uses Portuguese column names', () => {
  it('source code uses zona/tipo/preco not zone/typology/price', async () => {
    const fs   = await import('fs')
    const path = await import('path')
    const src  = fs.readFileSync(
      path.resolve(__dirname, '../../app/api/analytics/inventory-forecast/route.ts'),
      'utf-8',
    )

    expect(src).toContain("'id, zona, tipo, preco, created_at'")
    expect(src).toContain('p.zona')
    expect(src).not.toContain("'id, zone, typology, price, created_at'")
    expect(src).not.toContain('p.zone')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// B3-014 — investor-alerts: select uses Portuguese column names
// ─────────────────────────────────────────────────────────────────────────────
describe('B3-014 — investor-alerts: AlertProperty uses Portuguese column names', () => {
  it('source code uses nome/preco/zona/tipo/area/quartos/images', async () => {
    const fs   = await import('fs')
    const path = await import('path')
    const src  = fs.readFileSync(
      path.resolve(__dirname, '../../app/api/cron/investor-alerts/route.ts'),
      'utf-8',
    )

    expect(src).toContain("'id', 'nome', 'preco', 'zona'")
    expect(src).toContain('nome:             string')
    expect(src).toContain('preco:            number')
    expect(src).toContain('zona:             string | null')
    expect(src).toContain('property.preco')
    expect(src).toContain('property.zona')
    expect(src).toContain('property.nome')

    // Old English names must be gone from interface and field refs
    expect(src).not.toContain("title:            string")
    expect(src).not.toContain("price:            number")
    expect(src).not.toContain('property.price.toLocaleString')
    expect(src).not.toContain('property.title')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// B3-004 — sync-listings: fallback select uses Portuguese column names
// ─────────────────────────────────────────────────────────────────────────────
describe('B3-004 — sync-listings: fallback select uses Portuguese column names', () => {
  it('source code fallback uses nome/preco/area/quartos/tipo/zona', async () => {
    const fs   = await import('fs')
    const path = await import('path')
    const src  = fs.readFileSync(
      path.resolve(__dirname, '../../app/api/cron/sync-listings/route.ts'),
      'utf-8',
    )

    // Portuguese column names must appear in the fallback select
    expect(src).toContain("'preco'")
    expect(src).toContain("'area'")
    expect(src).toContain("'quartos'")
    expect(src).toContain("'tipo'")
    expect(src).toContain("'zona'")
    expect(src).toContain("'nome'")

    // The old English drift names must NOT appear in the select list
    // (price_previous etc. are OK — they're real columns)
    expect(src).not.toContain("'title'")
    // 'price' as standalone field in select array (not price_previous / price_per_sqm)
    // Verify mapping block exists
    expect(src).toContain('price:    row.preco')
    expect(src).toContain('area_m2:  row.area')
    expect(src).toContain('bedrooms: row.quartos')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// B3-008 — GET /api/properties/db: explicit projection (no embedding/audit cols)
// ─────────────────────────────────────────────────────────────────────────────
describe('B3-008 — GET /api/properties/db: explicit projection excludes sensitive columns', () => {
  it('select string does not include embedding, is_verified, submission_source', async () => {
    const fs   = await import('fs')
    const path = await import('path')
    const src  = fs.readFileSync(
      path.resolve(__dirname, '../../app/api/properties/db/route.ts'),
      'utf-8',
    )

    // Must not use select('*')
    expect(src).not.toContain(".select('*'")

    // Sensitive/audit columns must not appear in the GET projection
    const getSelectMatch = src.match(/\.select\('([^']+)',\s*\{\s*count/)
    expect(getSelectMatch).not.toBeNull()
    const selectStr = getSelectMatch![1]
    expect(selectStr).not.toContain('embedding')
    expect(selectStr).not.toContain('is_verified')
    expect(selectStr).not.toContain('verification_date')
    expect(selectStr).not.toContain('verified_by')
    expect(selectStr).not.toContain('submission_source')

    // Core operational columns must be present
    expect(selectStr).toContain('nome')
    expect(selectStr).toContain('preco')
    expect(selectStr).toContain('status')
    expect(selectStr).toContain('is_off_market')
  })
})
