/**
 * Phase 2A inbound route integration tests — D3 Foundation Hardening
 *
 * Verifies the route → service wiring for POST /api/leads and POST /api/contacto.
 *
 * Unlike __tests__/api/phase2a-inbound.test.ts (which extracts business logic
 * into local helpers and tests it in isolation), these tests import the ACTUAL
 * route handlers and mock only the external Supabase dependency. This catches:
 *
 *   - Route changed but copied test helper did not
 *   - Service signature changed but route test still passes
 *   - Identity guard removed from route (even if it still exists in service)
 *   - Source mapping changed (e.g. 'contacto' hardcoded in /api/contacto route)
 *   - DB failure not correctly propagated to caller
 *
 * Mock strategy:
 *   - @/lib/supabase → supabaseAdmin.rpc() controlled per test
 *   - @/lib/rateLimit → always allows (not under test here)
 *   - @/lib/observability/correlation → returns deterministic corrId
 *   No real DB calls. No real customer data.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Supabase mock ─────────────────────────────────────────────────────────────
const mockRpc = vi.fn()
const mockUtmUpdate = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    rpc: mockRpc,
    from: (_table: string) => ({
      update: (_data: unknown) => ({
        eq: (_col: string, _val: string) => ({ then: (_fn: unknown) => Promise.resolve() }),
      }),
    }),
  },
}))

// ── Rate limit: always allow ──────────────────────────────────────────────────
vi.mock('@/lib/rateLimit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 4 }),
  getRetryAfterMinutes: vi.fn().mockReturnValue(60),
}))

// ── Correlation ID: deterministic ─────────────────────────────────────────────
vi.mock('@/lib/observability/correlation', () => ({
  getRequestCorrelationId: vi.fn().mockReturnValue('test-corr-id'),
}))

// ── Resend: not needed (RESEND_API_KEY unset in tests) ───────────────────────
vi.mock('resend', () => ({ Resend: vi.fn() }))
vi.mock('@/lib/ops/withResend', () => ({
  withResend: vi.fn().mockResolvedValue({ data: null, error: null }),
}))

// ── RPC success fixture ───────────────────────────────────────────────────────
const RPC_SUCCESS = {
  data: { success: true, contact_id: 'cid-001', is_new: true, activity_id: 'aid-001' },
  error: null,
}
const RPC_FAILURE = {
  data: null,
  error: { message: 'DB error', code: 'PGRST200' },
}

function makeLeadsRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
    body: JSON.stringify(body),
  })
}

function makeContactoRequest(fields: Record<string, string>): NextRequest {
  const formData = new FormData()
  for (const [k, v] of Object.entries(fields)) formData.append(k, v)
  return new NextRequest('http://localhost/api/contacto', {
    method: 'POST',
    body: formData,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── POST /api/leads ───────────────────────────────────────────────────────────

describe('POST /api/leads — route → service wiring (D3)', () => {
  it('valid JSON with email → 200 success', async () => {
    mockRpc.mockResolvedValue(RPC_SUCCESS)
    const { POST } = await import('@/app/api/leads/route')
    const res = await POST(makeLeadsRequest({ email: 'buyer@example.com', source: 'website' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.id).toBe('cid-001')
  })

  it('valid JSON with phone only (no email) → 200 success', async () => {
    mockRpc.mockResolvedValue(RPC_SUCCESS)
    const { POST } = await import('@/app/api/leads/route')
    const res = await POST(makeLeadsRequest({ phone: '+351912345678', source: 'website' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('identity guard — no email AND no phone → 400 (rejected before RPC call)', async () => {
    const { POST } = await import('@/app/api/leads/route')
    const res = await POST(makeLeadsRequest({ name: 'Anonymous', source: 'website' }))
    // Route-level Zod refine: email OR phone required
    expect(res.status).toBe(400)
    // Service (RPC) must NOT be called — identity guard prevents anonymous leads
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('DB failure → 500 (route correctly propagates service failure)', async () => {
    mockRpc.mockResolvedValue(RPC_FAILURE)
    const { POST } = await import('@/app/api/leads/route')
    const res = await POST(makeLeadsRequest({ email: 'buyer@example.com' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('source is mapped to canonical IngestSource before reaching service', async () => {
    mockRpc.mockResolvedValue(RPC_SUCCESS)
    const { POST } = await import('@/app/api/leads/route')
    await POST(makeLeadsRequest({ email: 'buyer@example.com', source: 'property_enquiry' }))
    // Verify RPC was called with correct source (property_enquiry → property_enquiry)
    expect(mockRpc).toHaveBeenCalledWith(
      'ingest_commercial_lead_v1',
      expect.objectContaining({ p_source: 'property_enquiry' }),
    )
  })

  it('unknown source maps to website (fallback to canonical IngestSource)', async () => {
    mockRpc.mockResolvedValue(RPC_SUCCESS)
    const { POST } = await import('@/app/api/leads/route')
    await POST(makeLeadsRequest({ email: 'buyer@example.com', source: 'unknown_source_xyz' }))
    expect(mockRpc).toHaveBeenCalledWith(
      'ingest_commercial_lead_v1',
      expect.objectContaining({ p_source: 'website' }),
    )
  })
})

// ── POST /api/contacto ────────────────────────────────────────────────────────

describe('POST /api/contacto — route → service wiring (D3)', () => {
  it('valid formData with email → redirects to /contacto?obrigado=1', async () => {
    mockRpc.mockResolvedValue(RPC_SUCCESS)
    const { POST } = await import('@/app/api/contacto/route')
    const res = await POST(makeContactoRequest({ email: 'comprador@example.com', nome: 'João' }))
    // contacto route redirects on success (not JSON)
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    const location = res.headers.get('location')
    expect(location).toContain('obrigado=1')
  })

  it('identity guard — no email AND no phone → redirects to /contacto?erro=contacto', async () => {
    const { POST } = await import('@/app/api/contacto/route')
    const res = await POST(makeContactoRequest({ nome: 'Anonymous' }))
    // Amendment 4: require contactability
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    const location = res.headers.get('location')
    expect(location).toContain('erro=contacto')
    // Service must NOT be called
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('DB failure → redirects to /contacto?erro=sistema (no false success)', async () => {
    mockRpc.mockResolvedValue(RPC_FAILURE)
    const { POST } = await import('@/app/api/contacto/route')
    const res = await POST(makeContactoRequest({ email: 'comprador@example.com' }))
    const location = res.headers.get('location')
    expect(location).toContain('erro=sistema')
    // Verify CRM-first: the redirect to erro=sistema (not obrigado=1) proves
    // the route does NOT report success on DB failure
    expect(location).not.toContain('obrigado=1')
  })

  it('source is always contacto (hardcoded in /api/contacto route)', async () => {
    mockRpc.mockResolvedValue(RPC_SUCCESS)
    const { POST } = await import('@/app/api/contacto/route')
    await POST(makeContactoRequest({ email: 'comprador@example.com' }))
    // The contacto route MUST hardcode source='contacto' — this is the wiring test
    expect(mockRpc).toHaveBeenCalledWith(
      'ingest_commercial_lead_v1',
      expect.objectContaining({ p_source: 'contacto' }),
    )
  })

  it('valid formData with phone only (no email) → redirects to /contacto?obrigado=1', async () => {
    mockRpc.mockResolvedValue(RPC_SUCCESS)
    const { POST } = await import('@/app/api/contacto/route')
    const res = await POST(makeContactoRequest({ tel: '+351912345678' }))
    const location = res.headers.get('location')
    expect(location).toContain('obrigado=1')
  })
})
