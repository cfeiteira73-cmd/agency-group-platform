/**
 * Phase 2C.B1 — Partner Submission Route Tests
 *
 * Verifies the partner property submission flow POST /api/properties:
 *
 *   Test 1 — Valid submission persists with correct fields
 *   Test 2 — Property persistence failure → non-2xx, no false success
 *   Test 3 — Contact upsert idempotency (repeated submission same email)
 *   Test 4 — Validation: missing required fields → 400
 *   Test 5 — Rate limit enforcement → 429
 *   Test 6 — No automatic verification: is_verified=false, submission_source='partner'
 *
 * Mock strategy:
 *   @/lib/supabase  → supabaseAdmin.from() controlled per test
 *   @/lib/rateLimit → controlled per test (allow or block)
 *   @/lib/observability/correlation → deterministic corrId
 *   resend          → always resolves (email delivery not under test here)
 *
 * No real DB calls. No real customer data. Uses synthetic identifiers throughout.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── vi.hoisted: all variables used inside vi.mock factories must be hoisted ──
const {
  mockContactsUpsert,
  mockPropertiesInsert,
  mockRateLimit,
} = vi.hoisted(() => ({
  mockContactsUpsert:   vi.fn(),
  mockPropertiesInsert: vi.fn(),
  mockRateLimit:        vi.fn(),
}))

// ── Supabase mock ─────────────────────────────────────────────────────────────
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'contacts') {
        return { upsert: mockContactsUpsert }
      }
      if (table === 'properties') {
        return {
          insert: mockPropertiesInsert,
          select: vi.fn().mockReturnThis(),
          not:    vi.fn().mockReturnThis(),
          eq:     vi.fn().mockReturnThis(),
          limit:  vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        limit:  vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    },
  },
}))

// ── Rate limit mock ───────────────────────────────────────────────────────────
vi.mock('@/lib/rateLimit', () => ({
  rateLimit:            mockRateLimit,
  getRetryAfterMinutes: vi.fn().mockReturnValue(60),
}))

// ── Correlation ID ────────────────────────────────────────────────────────────
vi.mock('@/lib/observability/correlation', () => ({
  getRequestCorrelationId: vi.fn().mockReturnValue('b1-test-corr-id'),
}))

// ── Resend: always succeeds (not under test) ──────────────────────────────────
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'email-id' }, error: null }),
    },
  })),
}))

// ── SLO tracker (not under test) ─────────────────────────────────────────────
vi.mock('@/lib/sre/sloTracker', () => ({
  recordRequest: vi.fn().mockResolvedValue(undefined),
}))

// ── Auth (GET handler only — mocked to prevent next-auth ESM resolution error)
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/portalAuth', () => ({
  isPortalAuth: vi.fn().mockResolvedValue(false),
}))

// ── Import handler AFTER mocks ────────────────────────────────────────────────
import { POST } from '@/app/api/properties/route'

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Minimum valid partner submission body */
const VALID_BODY = {
  agencyName:  'Agência Teste Sintética Lda',
  agencyAMI:   'AMI-99999',
  agencyEmail: 'synthetic-test@example-b1-test.invalid',
  agencyPhone: '+351999000000',
  nome:        'Apartamento Sintético B1',
  zona:        'Lisboa',
  tipo:        'Apartamento',
  preco:       750000,
  area:        95,
}

function makeRequest(body: Record<string, unknown> = VALID_BODY): NextRequest {
  return new NextRequest('http://localhost/api/properties', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.1' },
    body:    JSON.stringify(body),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
  // Default: rate limit allows
  mockRateLimit.mockResolvedValue({ success: true, remaining: 2 })
  // Default: contact upsert succeeds
  mockContactsUpsert.mockResolvedValue({ data: [{ id: 'cid-synthetic' }], error: null })
  // Default: property insert succeeds
  mockPropertiesInsert.mockResolvedValue({ data: [{ id: 'pid-synthetic' }], error: null })
  // Set email env vars for tests
  process.env.AGENT_ALERT_EMAIL  = ''
  process.env.RESEND_API_KEY     = ''
})

// ─────────────────────────────────────────────────────────────────────────────

describe('Phase 2C.B1 — partner submission', () => {

  // ── Test 1: Valid submission ────────────────────────────────────────────────
  it('valid submission returns 200 and property is inserted with correct fields', async () => {
    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.error).toBeUndefined()

    // Property insert must have been called
    expect(mockPropertiesInsert).toHaveBeenCalledTimes(1)

    const insertedProperty = mockPropertiesInsert.mock.calls[0][0]

    // B1 mandatory fields
    expect(insertedProperty.status).toBe('pending_review')
    expect(insertedProperty.is_off_market).toBe(true)
    expect(insertedProperty.is_verified).toBe(false)
    expect(insertedProperty.submission_source).toBe('partner')

    // Verification fields must be absent (null/undefined — not set on insert)
    expect(insertedProperty.verification_date ?? null).toBeNull()
    expect(insertedProperty.verified_by ?? null).toBeNull()

    // Core fields must use Portuguese production column names
    expect(insertedProperty.nome).toBe(VALID_BODY.nome)       // nome (not title)
    expect(insertedProperty.zona).toBe(VALID_BODY.zona)       // zona (not zone)
    expect(insertedProperty.preco).toBe(VALID_BODY.preco)     // preco (not price)
    expect(insertedProperty.area).toBe(VALID_BODY.area)       // area (not area_m2)

    // Type mapping: 'Apartamento' → stored as canonical Portuguese 'Apartamento'
    expect(insertedProperty.tipo).toBe('Apartamento')         // tipo (not type), Portuguese value

    // English column names must NOT be used in the INSERT
    expect(insertedProperty.title).toBeUndefined()
    expect(insertedProperty.zone).toBeUndefined()
    expect(insertedProperty.type).toBeUndefined()
    expect(insertedProperty.price).toBeUndefined()
    expect(insertedProperty.area_m2).toBeUndefined()
    expect(insertedProperty.bedrooms).toBeUndefined()
    expect(insertedProperty.bathrooms).toBeUndefined()

    // notes column must NOT be included (column does not exist in schema)
    expect(insertedProperty.notes).toBeUndefined()
  })

  // ── Test 2: Persistence failure → non-2xx, no false success ────────────────
  it('property persistence failure returns 500 and never claims success', async () => {
    mockPropertiesInsert.mockResolvedValue({
      data:  null,
      error: { code: '22P02', message: 'invalid input value for enum property_status' },
    })

    const res = await POST(makeRequest())
    const body = await res.json()

    // Must be a non-2xx response — success: true is forbidden
    expect(res.status).toBe(500)
    expect(body.success).toBeUndefined()
    expect(body.error).toBeDefined()
    expect(typeof body.error).toBe('string')

    // Error message must not leak database internals
    expect(body.error).not.toContain('pg_')
    expect(body.error).not.toContain('22P02')
    expect(body.error).not.toContain('PGRST')
  })

  // ── Test 2b: catch-block must not be the only error handler ────────────────
  it('property error returned as { error } object (not thrown) is still caught and returns 500', async () => {
    // Simulate the exact BUG-1 scenario: { data: null, error: {...} }
    // This is how Supabase JS returns errors — it does NOT throw
    mockPropertiesInsert.mockResolvedValue({
      data:  null,
      error: { code: 'PGRST301', message: 'Row level security violation' },
    })

    const res = await POST(makeRequest())

    // Must NOT return 200 — the old bug would have returned 200 here
    expect(res.status).not.toBe(200)
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.success).toBeUndefined()
    expect(body.error).toBeDefined()
  })

  // ── Test 3: Contact idempotency ─────────────────────────────────────────────
  it('repeated submission with same email calls contact upsert (idempotent by design)', async () => {
    // First call
    await POST(makeRequest())
    // Second call with same email
    await POST(makeRequest())

    // Both calls should upsert the contact (onConflict: email is the idempotency guarantee)
    // The DB handles deduplication — route should call upsert each time
    expect(mockContactsUpsert).toHaveBeenCalledTimes(2)

    // Both calls should attempt property insert
    expect(mockPropertiesInsert).toHaveBeenCalledTimes(2)
  })

  // ── Test 4: Validation — missing required fields returns 400 ───────────────
  it('missing required field returns 400 before any DB call', async () => {
    const incomplete = {
      agencyName:  'Agência Teste',
      agencyEmail: 'test@example.invalid',
      // missing agencyAMI, agencyPhone, nome, zona, preco, area
    }

    const res = await POST(makeRequest(incomplete))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBeDefined()

    // Validation must fire before any DB calls
    expect(mockContactsUpsert).not.toHaveBeenCalled()
    expect(mockPropertiesInsert).not.toHaveBeenCalled()
  })

  // ── Test 5: Rate limit — 429 before any processing ─────────────────────────
  it('rate-limited request returns 429 without touching DB', async () => {
    mockRateLimit.mockResolvedValue({ success: false, remaining: 0 })

    const res = await POST(makeRequest())

    expect(res.status).toBe(429)

    expect(mockContactsUpsert).not.toHaveBeenCalled()
    expect(mockPropertiesInsert).not.toHaveBeenCalled()
  })

  // ── Test 6: No automatic verification ──────────────────────────────────────
  it('partner submission is always unverified, off-market, and pending review', async () => {
    await POST(makeRequest())

    const insertedProperty = mockPropertiesInsert.mock.calls[0][0]

    // SUBMITTED ≠ VERIFIED
    expect(insertedProperty.is_verified).toBe(false)
    expect(insertedProperty.verification_date ?? null).toBeNull()
    expect(insertedProperty.verified_by ?? null).toBeNull()

    // VERIFIED ≠ AVAILABLE
    expect(insertedProperty.status).toBe('pending_review')
    expect(insertedProperty.is_off_market).toBe(true)

    // AVAILABLE ≠ PUBLISHED (portal_published is not set in the insert — DB default false)
    expect(insertedProperty.portal_published).toBeUndefined()

    // Provenance
    expect(insertedProperty.submission_source).toBe('partner')
  })

  // ── Test 7: Type mapping — Portuguese tipo → canonical Portuguese storage ──
  it('maps Portuguese property types to canonical Portuguese production storage values', async () => {
    const typeTests: Array<[string, string]> = [
      ['Apartamento',      'Apartamento'],
      ['Moradia',          'Moradia'],
      ['Moradia em Banda', 'Moradia em Banda'],
      ['Penthouse',        'Penthouse'],
      ['Villa',            'Villa'],
      ['Terreno',          'Terreno'],
      ['Comercial',        'Comercial'],
      ['Escritório',       'Escritório'],
    ]

    for (const [tipo, expectedType] of typeTests) {
      vi.clearAllMocks()
      mockRateLimit.mockResolvedValue({ success: true, remaining: 2 })
      mockContactsUpsert.mockResolvedValue({ data: [], error: null })
      mockPropertiesInsert.mockResolvedValue({ data: [{ id: 'pid' }], error: null })

      await POST(makeRequest({ ...VALID_BODY, tipo }))

      const inserted = mockPropertiesInsert.mock.calls[0][0]
      expect(inserted.tipo).toBe(expectedType)
    }
  })

  // ── Test 8: Villa → Villa (explicit proof — not Moradia, not Apartamento) ──
  it('Villa maps to canonical Villa — not Moradia, not Apartamento', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, tipo: 'Villa' }))

    expect(res.status).toBe(200)
    const inserted = mockPropertiesInsert.mock.calls[0][0]
    expect(inserted.tipo).toBe('Villa')
    expect(inserted.tipo).not.toBe('Moradia')
    expect(inserted.tipo).not.toBe('Apartamento')
  })

  // ── Test 9: Quinta → HTTP 400, never reaches property INSERT ───────────────
  it('Quinta is rejected with 400 and never reaches property INSERT', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, tipo: 'Quinta' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBeDefined()
    expect(typeof body.error).toBe('string')
    // Must not have reached INSERT — Quinta must not become apartment or any other type
    expect(mockPropertiesInsert).not.toHaveBeenCalled()
  })

  // ── Test 10: Herdade → HTTP 400, never reaches property INSERT ─────────────
  it('Herdade is rejected with 400 and never reaches property INSERT', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, tipo: 'Herdade' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBeDefined()
    expect(typeof body.error).toBe('string')
    // Must not have reached INSERT — Herdade must not become apartment or any other type
    expect(mockPropertiesInsert).not.toHaveBeenCalled()
  })

  // ── Test 11: Unknown type → HTTP 400, never reaches property INSERT ─────────
  it('arbitrary unknown tipo is rejected with 400 and never reaches property INSERT', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, tipo: 'Castelo' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBeDefined()
    // Must not have reached INSERT
    expect(mockPropertiesInsert).not.toHaveBeenCalled()
  })

  // ── Test 12: No apartment fallback — unknown type never stored as apartment ──
  it('no unknown tipo is silently stored as apartment', async () => {
    const unknownTypes = ['Quinta', 'Herdade', 'Castelo', 'Palácio', 'Ruína', 'XYZ']

    for (const tipo of unknownTypes) {
      vi.clearAllMocks()
      mockRateLimit.mockResolvedValue({ success: true, remaining: 2 })
      mockContactsUpsert.mockResolvedValue({ data: [], error: null })
      mockPropertiesInsert.mockResolvedValue({ data: [{ id: 'pid' }], error: null })

      const res = await POST(makeRequest({ ...VALID_BODY, tipo }))

      // Must be a controlled rejection — not a 200 with fabricated type
      expect(res.status).toBe(400)
      // Property INSERT must not have been attempted
      expect(mockPropertiesInsert).not.toHaveBeenCalled()

      // Explicit proof: if somehow INSERT was called, it must not use any English column or fallback tipo
      if (mockPropertiesInsert.mock.calls.length > 0) {
        const inserted = mockPropertiesInsert.mock.calls[0][0]
        expect(inserted.tipo).not.toBe('Apartamento')
        expect(inserted.type).toBeUndefined()
      }
    }
  })

})
