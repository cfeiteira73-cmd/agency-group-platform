/**
 * Phase 2C.B1-SR — Operational Reviewability Tests (Schema Reconciliation)
 *
 * Tests for GET /api/properties (internal portal route, supabaseAdmin):
 *
 *   OR-1 — SELECT uses Portuguese DB column names (nome, zona, tipo, preco, area…)
 *   OR-2 — Response DTO maps to camelCase DTO fields (casasBanho, imagens, matterportUrl…)
 *   OR-3 — pending_review rows appear when status=all
 *   OR-4 — eq('status', …) filter applied for non-all status values
 *   OR-5 — active rows returned; status=active filter applied by default
 *   OR-6 — Filter predicates use Portuguese DB column names (zona, tipo, preco)
 *   OR-7 — Empty DB result returns { data: [], source: 'empty' }
 *   SR-12 — Regression: no English schema column names in SELECT or filter predicates
 *
 * PRODUCTION TRUTH: properties table has Portuguese column names.
 * English names (title, zone, type, price, area_m2, bedrooms, bathrooms) DO NOT EXIST.
 * Mocks model actual production schema — not English staging assumptions.
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

// ── Fixtures — model actual production schema (Portuguese column names) ────────

/** Synthetic DB row using PRODUCTION Portuguese column names */
const MOCK_ACTIVE_ROW = {
  id:                   'prop-or-test-001',
  nome:                 'Apartamento OR Test',       // production: nome (not title)
  zona:                 'Lisboa',                    // production: zona (not zone)
  bairro:               'Chiado',                   // production: bairro (not city)
  tipo:                 'Apartamento',               // production: tipo (not type)
  preco:                500000,                      // production: preco (not price)
  area:                 80,                          // production: area (not area_m2)
  quartos:              2,                           // production: quartos (not bedrooms)
  casas_banho:          1,                           // production: casas_banho (not bathrooms)
  energia:              'B',                         // production: energia (not energy_certificate)
  status:               'active',
  descricao:            'Descrição teste OR',        // production: descricao (not description)
  features:             ['Piscina'],
  images:               ['https://example.invalid/photo.jpg'], // production: images (not photos)
  matterport_url:       null,                        // production: matterport_url (not virtual_tour_url)
  is_verified:          false,                       // B1 column (added by migration 067)
  submission_source:    null,                        // B1 column (added by migration 067)
  created_at:           '2026-09-14T10:00:00Z',
}

/** Synthetic pending_review row submitted by a partner */
const MOCK_PENDING_ROW = {
  ...MOCK_ACTIVE_ROW,
  id:                'prop-or-test-002',
  nome:              'Imóvel Pendente OR Test',
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

describe('Phase 2C.B1-SR — operational reviewability (GET /api/properties)', () => {

  // ── OR-1: SELECT uses Portuguese DB column names ────────────────────────────
  it('OR-1: SELECT uses Portuguese production column names, not English legacy names', async () => {
    mockState.queryResult = { data: [MOCK_ACTIVE_ROW], error: null }
    await GET(makeGETRequest())

    // Portuguese column names must be present in SELECT
    expect(mockState.capturedSelect).toContain('nome')
    expect(mockState.capturedSelect).toContain('zona')
    expect(mockState.capturedSelect).toContain('tipo')
    expect(mockState.capturedSelect).toContain('preco')
    expect(mockState.capturedSelect).toContain('area')
    expect(mockState.capturedSelect).toContain('quartos')
    expect(mockState.capturedSelect).toContain('casas_banho')
    expect(mockState.capturedSelect).toContain('energia')
    expect(mockState.capturedSelect).toContain('descricao')
    expect(mockState.capturedSelect).toContain('images')

    // .not() anchor must use Portuguese nome column
    expect(mockState.capturedNot).toBe('nome')
  })

  // ── SR-12 (embedded in OR-1): English column names must NOT appear in SELECT ─
  it('SR-12: English column names must NOT appear in SELECT or filter calls', async () => {
    mockState.queryResult = { data: [MOCK_ACTIVE_ROW], error: null }
    await GET(makeGETRequest({ zona: 'Lisboa', tipo: 'Apartamento', max_preco: '1000000', status: 'all' }))

    // English column names that do NOT exist in production must never appear in DB queries
    expect(mockState.capturedSelect).not.toMatch(/\btitle\b/)
    expect(mockState.capturedSelect).not.toMatch(/\bzone\b/)
    expect(mockState.capturedSelect).not.toMatch(/\btype\b/)
    expect(mockState.capturedSelect).not.toMatch(/\bprice\b/)
    expect(mockState.capturedSelect).not.toContain('area_m2')
    expect(mockState.capturedSelect).not.toContain('bedrooms')
    expect(mockState.capturedSelect).not.toContain('bathrooms')
    expect(mockState.capturedSelect).not.toContain('description')
    expect(mockState.capturedSelect).not.toContain('photos')
    expect(mockState.capturedSelect).not.toContain('virtual_tour_url')
    expect(mockState.capturedSelect).not.toContain('views_total')
    expect(mockState.capturedSelect).not.toContain('energy_certificate')

    // English column names must also not appear in filter predicates
    const eqCols  = mockState.capturedEqs.map(([col]) => col)
    const lteCols = mockState.capturedLtes.map(([col]) => col)
    expect(eqCols).not.toContain('zone')
    expect(eqCols).not.toContain('type')
    expect(lteCols).not.toContain('price')
    expect(mockState.capturedNot).not.toBe('title')
  })

  // ── OR-2: Response DTO maps Portuguese DB columns to camelCase DTO ───────────
  it('OR-2: response DTO maps Portuguese DB columns to camelCase DTO fields', async () => {
    mockState.queryResult = { data: [MOCK_ACTIVE_ROW], error: null }
    const res = await GET(makeGETRequest({ status: 'all' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.source).toBe('supabase')
    expect(body.data).toHaveLength(1)

    const dto = body.data[0]

    // Portuguese base fields preserved as-is
    expect(dto.nome).toBe(MOCK_ACTIVE_ROW.nome)
    expect(dto.zona).toBe(MOCK_ACTIVE_ROW.zona)
    expect(dto.bairro).toBe(MOCK_ACTIVE_ROW.bairro)
    expect(dto.tipo).toBe(MOCK_ACTIVE_ROW.tipo)
    expect(dto.preco).toBe(MOCK_ACTIVE_ROW.preco)
    expect(dto.area).toBe(MOCK_ACTIVE_ROW.area)
    expect(dto.quartos).toBe(MOCK_ACTIVE_ROW.quartos)
    expect(dto.energia).toBe(MOCK_ACTIVE_ROW.energia)
    expect(dto.status).toBe(MOCK_ACTIVE_ROW.status)
    expect(dto.descricao).toBe(MOCK_ACTIVE_ROW.descricao)

    // camelCase conversions
    expect(dto.casasBanho).toBe(MOCK_ACTIVE_ROW.casas_banho)
    expect(Array.isArray(dto.imagens)).toBe(true)     // images → imagens
    expect(dto.isVerified).toBe(false)                // is_verified → isVerified
    expect(dto.submissionSource).toBe(null)           // submission_source → submissionSource

    // DTO must NOT expose raw snake_case DB field names
    expect(dto.casas_banho).toBeUndefined()
    expect(dto.matterport_url).toBeUndefined()
    expect(dto.is_verified).toBeUndefined()
    expect(dto.submission_source).toBeUndefined()

    // DTO must NOT expose English column names
    expect(dto.title).toBeUndefined()
    expect(dto.zone).toBeUndefined()
    expect(dto.type).toBeUndefined()
    expect(dto.price).toBeUndefined()
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
    expect(body.data[0].nome).toBe(MOCK_PENDING_ROW.nome)

    // status=all must NOT add a status eq() filter
    const statusFilter = mockState.capturedEqs.find(([col]) => col === 'status')
    expect(statusFilter).toBeUndefined()
  })

  // ── OR-4: status eq filter applied for explicit status values ───────────────
  it('OR-4: eq("status", …) filter applied when status param is not "all"', async () => {
    mockState.queryResult = { data: [MOCK_ACTIVE_ROW], error: null }
    await GET(makeGETRequest({ status: 'active' }))

    const statusFilter = mockState.capturedEqs.find(([col]) => col === 'status')
    expect(statusFilter).toBeDefined()
    expect(statusFilter![1]).toBe('active')
  })

  // ── OR-5: active rows returned by default ───────────────────────────────────
  it('OR-5: status=active filter applied by default (no status param)', async () => {
    mockState.queryResult = { data: [MOCK_ACTIVE_ROW], error: null }
    const res = await GET(makeGETRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].status).toBe('active')

    const statusFilter = mockState.capturedEqs.find(([col]) => col === 'status')
    expect(statusFilter).toBeDefined()
    expect(statusFilter![1]).toBe('active')
  })

  // ── OR-6: Filter predicates use Portuguese column names ────────────────────
  it('OR-6: filter predicates use Portuguese column names (zona, tipo, preco) not English (zone, type, price)', async () => {
    mockState.queryResult = { data: [MOCK_ACTIVE_ROW], error: null }
    await GET(makeGETRequest({ zona: 'Lisboa', tipo: 'Apartamento', max_preco: '1000000', status: 'all' }))

    const eqCols  = mockState.capturedEqs.map(([col]) => col)
    const lteCols = mockState.capturedLtes.map(([col]) => col)

    // Portuguese column names must be used in filter predicates
    expect(eqCols).toContain('zona')
    expect(eqCols).toContain('tipo')
    expect(lteCols).toContain('preco')

    // English column names must NOT appear as filter predicates
    expect(eqCols).not.toContain('zone')
    expect(eqCols).not.toContain('type')
    expect(lteCols).not.toContain('price')
  })

  // ── OR-7: Empty DB result → { data: [], source: 'empty' } ─────────────────
  it('OR-7: empty DB result returns { data: [], source: "empty" }', async () => {
    mockState.queryResult = { data: [], error: null }
    const res = await GET(makeGETRequest({ status: 'all' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual([])
    expect(body.source).toBe('empty')
    expect(body.source).not.toBe('supabase')
  })

})
