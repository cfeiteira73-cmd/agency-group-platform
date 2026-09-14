/**
 * Phase 2C.B1-OR — Operational Reviewability Tests
 *
 * Tests for GET /api/properties (internal portal route, supabaseAdmin):
 *
 *   OR-1 — SELECT uses English column names (title, zone, type, price, area_m2…)
 *   OR-2 — Response DTO maps to Portuguese field names (nome, zona, tipo, preco…)
 *   OR-3 — pending_review rows appear when status=all
 *   OR-4 — eq('status', …) filter is applied for non-all status values
 *   OR-5 — active rows returned; status=active filter applied by default
 *   OR-6 — Filter predicates use English DB column names (zone, type, price)
 *   OR-7 — Empty DB result returns { data: [], source: 'empty' }
 *
 * Mock strategy:
 *   @/lib/supabase      → chainable query builder capturing SELECT/filter calls
 *   @/auth              → authenticated staff session (bypasses 401 guard)
 *   @/lib/portalAuth    → false (not needed when session present)
 *   correlation/sloTracker → deterministic / no-op
 *
 * No real DB calls. No real customer data. Uses synthetic identifiers throughout.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── vi.hoisted: shared mutable state accessible inside vi.mock factories ───────
const mockState = vi.hoisted(() => {
  const state = {
    capturedSelect: '',
    capturedNot:    '',
    capturedEqs:    [] as Array<[string, unknown]>,
    capturedLtes:   [] as Array<[string, unknown]>,
    queryResult:    { data: [] as unknown[], error: null as unknown },

    reset() {
      state.capturedSelect = ''
      state.capturedNot    = ''
      state.capturedEqs    = []
      state.capturedLtes   = []
      state.queryResult    = { data: [], error: null }
    },

    makeChain() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        select: (s: string)                  => { state.capturedSelect = s; return chain },
        not:    (col: string)                => { state.capturedNot = col; return chain },
        eq:     (col: string, val: unknown)  => { state.capturedEqs.push([col, val]); return chain },
        lte:    (col: string, val: unknown)  => { state.capturedLtes.push([col, val]); return chain },
        limit:  (..._: unknown[])            => chain,
        then:   (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(state.queryResult).then(resolve, reject),
        catch:  (cb: (e: unknown) => unknown) =>
          Promise.resolve(state.queryResult).catch(cb),
      }
      return chain
    },
  }
  return state
})

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'properties') return mockState.makeChain()
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
    },
  },
}))

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'staff-or-test-user' } }),
}))

vi.mock('@/lib/portalAuth', () => ({
  isPortalAuth: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/lib/observability/correlation', () => ({
  getRequestCorrelationId: vi.fn().mockReturnValue('or-test-corr-id'),
}))

vi.mock('@/lib/sre/sloTracker', () => ({
  recordRequest: vi.fn().mockResolvedValue(undefined),
}))

// ── Import handler AFTER all mocks ────────────────────────────────────────────
import { GET } from '@/app/api/properties/route'

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Synthetic DB row using English schema column names (as canonical DB returns) */
const MOCK_ACTIVE_ROW = {
  id:                   'prop-or-test-001',
  title:                'Apartamento OR Test',
  zone:                 'Lisboa',
  city:                 'Lisboa',
  type:                 'apartment',
  price:                500000,
  area_m2:              80,
  bedrooms:             2,
  bathrooms:            1,
  energy_certificate:   'B',
  status:               'active',
  description:          'Descrição teste OR',
  features:             ['Piscina'],
  photos:               ['https://example.invalid/photo.jpg'],
  virtual_tour_url:     null,
  is_verified:          false,
  submission_source:    null,
  views_total:          5,
  created_at:           '2026-09-14T10:00:00Z',
}

/** Synthetic pending_review row submitted by a partner */
const MOCK_PENDING_ROW = {
  ...MOCK_ACTIVE_ROW,
  id:                'prop-or-test-002',
  title:             'Imóvel Pendente OR Test',
  status:            'pending_review',
  is_verified:       false,
  submission_source: 'partner',
}

function makeGETRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/properties')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url)
}

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockState.reset()
})

// ─────────────────────────────────────────────────────────────────────────────

describe('Phase 2C.B1-OR — operational reviewability (GET /api/properties)', () => {

  // ── OR-1: SELECT uses English column names ──────────────────────────────────
  it('OR-1: SELECT uses English DB column names, not Portuguese legacy names', async () => {
    mockState.queryResult = { data: [MOCK_ACTIVE_ROW], error: null }
    await GET(makeGETRequest())

    // English column names must be present in SELECT
    expect(mockState.capturedSelect).toContain('title')
    expect(mockState.capturedSelect).toContain('zone')
    expect(mockState.capturedSelect).toContain('type')
    expect(mockState.capturedSelect).toContain('price')
    expect(mockState.capturedSelect).toContain('area_m2')
    expect(mockState.capturedSelect).toContain('bedrooms')
    expect(mockState.capturedSelect).toContain('bathrooms')
    expect(mockState.capturedSelect).toContain('energy_certificate')
    expect(mockState.capturedSelect).toContain('description')
    expect(mockState.capturedSelect).toContain('photos')

    // Portuguese column names that DO NOT exist in production must NOT appear in SELECT
    expect(mockState.capturedSelect).not.toMatch(/\bnome\b/)
    expect(mockState.capturedSelect).not.toMatch(/\bzona\b/)
    expect(mockState.capturedSelect).not.toMatch(/\btipo\b/)
    expect(mockState.capturedSelect).not.toMatch(/\bpreco\b/)
    expect(mockState.capturedSelect).not.toContain('casas_banho')
    expect(mockState.capturedSelect).not.toContain('gradient')
    expect(mockState.capturedSelect).not.toContain('badge')
    expect(mockState.capturedSelect).not.toContain('lifestyle_tags')

    // .not() anchor must use English title column
    expect(mockState.capturedNot).toBe('title')
  })

  // ── OR-2: Response DTO maps English DB columns → Portuguese field names ──────
  it('OR-2: response DTO maps English DB values to Portuguese field names (ImovelFull contract)', async () => {
    mockState.queryResult = { data: [MOCK_ACTIVE_ROW], error: null }
    const res = await GET(makeGETRequest({ status: 'all' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.source).toBe('supabase')
    expect(body.data).toHaveLength(1)

    const dto = body.data[0]

    // DTO must expose Portuguese field names with values from English DB columns
    expect(dto.nome).toBe(MOCK_ACTIVE_ROW.title)
    expect(dto.zona).toBe(MOCK_ACTIVE_ROW.zone)
    expect(dto.bairro).toBe(MOCK_ACTIVE_ROW.city)
    expect(dto.tipo).toBe(MOCK_ACTIVE_ROW.type)
    expect(dto.preco).toBe(MOCK_ACTIVE_ROW.price)
    expect(dto.area).toBe(MOCK_ACTIVE_ROW.area_m2)
    expect(dto.quartos).toBe(MOCK_ACTIVE_ROW.bedrooms)
    expect(dto.casasBanho).toBe(MOCK_ACTIVE_ROW.bathrooms)
    expect(dto.energia).toBe(MOCK_ACTIVE_ROW.energy_certificate)
    expect(dto.descricao).toBe(MOCK_ACTIVE_ROW.description)
    expect(dto.status).toBe(MOCK_ACTIVE_ROW.status)
    expect(Array.isArray(dto.imagens)).toBe(true)

    // DTO must NOT expose raw English column names as top-level keys
    expect(dto.title).toBeUndefined()
    expect(dto.zone).toBeUndefined()
    expect(dto.area_m2).toBeUndefined()
    expect(dto.bedrooms).toBeUndefined()
    expect(dto.bathrooms).toBeUndefined()
    expect(dto.description).toBeUndefined()
    expect(dto.energy_certificate).toBeUndefined()
  })

  // ── OR-3: pending_review rows visible when status=all ──────────────────────
  it('OR-3: pending_review rows appear in response when status=all', async () => {
    mockState.queryResult = { data: [MOCK_PENDING_ROW], error: null }
    const res = await GET(makeGETRequest({ status: 'all' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.source).toBe('supabase')
    expect(body.data).toHaveLength(1)
    expect(body.data[0].status).toBe('pending_review')
    expect(body.data[0].nome).toBe(MOCK_PENDING_ROW.title)

    // status=all must NOT add a status eq() filter — the query returns all statuses
    const statusFilter = mockState.capturedEqs.find(([col]) => col === 'status')
    expect(statusFilter).toBeUndefined()
  })

  // ── OR-4: status eq filter applied for explicit status values ───────────────
  it('OR-4: eq("status", …) filter is applied when status param is not "all"', async () => {
    mockState.queryResult = { data: [MOCK_ACTIVE_ROW], error: null }
    await GET(makeGETRequest({ status: 'active' }))

    const statusFilter = mockState.capturedEqs.find(([col]) => col === 'status')
    expect(statusFilter).toBeDefined()
    expect(statusFilter![1]).toBe('active')
  })

  // ── OR-5: active rows returned by default; status=active filter applied ─────
  it('OR-5: active rows returned and status=active filter applied by default (no status param)', async () => {
    mockState.queryResult = { data: [MOCK_ACTIVE_ROW], error: null }
    const res = await GET(makeGETRequest()) // no status param → defaults to 'active'
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].status).toBe('active')

    // Default must apply status=active filter
    const statusFilter = mockState.capturedEqs.find(([col]) => col === 'status')
    expect(statusFilter).toBeDefined()
    expect(statusFilter![1]).toBe('active')
  })

  // ── OR-6: Filter predicates use English DB column names ────────────────────
  it('OR-6: filter predicates use English column names (zone, type, price) not Portuguese (zona, tipo, preco)', async () => {
    mockState.queryResult = { data: [MOCK_ACTIVE_ROW], error: null }
    await GET(makeGETRequest({ zona: 'Lisboa', tipo: 'apartment', max_preco: '1000000', status: 'all' }))

    const eqCols  = mockState.capturedEqs.map(([col]) => col)
    const lteCols = mockState.capturedLtes.map(([col]) => col)

    // English column names must be used in filter predicates
    expect(eqCols).toContain('zone')
    expect(eqCols).toContain('type')
    expect(lteCols).toContain('price')

    // Portuguese column names must NOT appear as filter predicates
    expect(eqCols).not.toContain('zona')
    expect(eqCols).not.toContain('tipo')
    expect(lteCols).not.toContain('preco')
  })

  // ── OR-7: Empty DB result → { data: [], source: 'empty' } ─────────────────
  it('OR-7: empty DB result returns { data: [], source: "empty" } not source: "supabase"', async () => {
    mockState.queryResult = { data: [], error: null }
    const res = await GET(makeGETRequest({ status: 'all' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual([])
    expect(body.source).toBe('empty')
    expect(body.source).not.toBe('supabase')
  })

})
