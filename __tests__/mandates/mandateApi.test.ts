// =============================================================================
// Phase 2B.2 — Mandate API Security Tests
// Tests: IDOR, owner mass-assignment, profile-absent, subresource IDOR.
// Uses mocked session + mocked supabaseAdmin.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Shared mock state ──────────────────────────────────────────────────────────
const mockSession = vi.fn()
const mockContactQuery   = vi.fn()
const mockMandateQuery   = vi.fn()
const mockProfileQuery   = vi.fn()
const mockRpc            = vi.fn()

vi.mock('@/auth', () => ({ auth: mockSession }))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => ({
        eq: (..._args: unknown[]) => ({
          eq: (..._args2: unknown[]) => ({
            single: () => {
              if (table === 'contacts') return mockContactQuery()
              if (table === 'demand_mandates') return mockMandateQuery()
              if (table === 'profiles') return mockProfileQuery()
              return { data: null, error: null }
            },
          }),
          single: () => {
            if (table === 'contacts') return mockContactQuery()
            if (table === 'demand_mandates') return mockMandateQuery()
            if (table === 'profiles') return mockProfileQuery()
            return { data: null, error: null }
          },
        }),
      }),
      insert: () => ({ select: () => ({ single: () => ({ data: null, error: { message: 'insert' } }) }) }),
      update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ single: () => ({ data: null, error: null }) }) }) }) }),
    }),
    rpc: mockRpc,
  },
}))

// ── Helper ──────────────────────────────────────────────────────────────────

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ── POST /api/mandates — IDOR and security tests ───────────────────────────────

describe('POST /api/mandates — security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('401 when no session', async () => {
    mockSession.mockResolvedValue(null)
    const { POST } = await import('@/app/api/mandates/route')
    const req = makeRequest('POST', 'http://localhost/api/mandates', {
      holder_contact_id: 1,
      transaction_mode: 'BUY',
      purpose: 'INVESTMENT',
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('403 when agent tries to create mandate for another agent\'s contact (IDOR)', async () => {
    mockSession.mockResolvedValue({
      user: { id: 'agent-a-uuid', role: 'consultant' },
    })
    // Contact exists but assigned to agent B, not agent A
    mockContactQuery.mockResolvedValue({
      data: { id: 1, assigned_to: 'agent-b-uuid' },
      error: null,
    })

    const { POST } = await import('@/app/api/mandates/route')
    const req = makeRequest('POST', 'http://localhost/api/mandates', {
      holder_contact_id: 1,
      transaction_mode: 'BUY',
      purpose: 'INVESTMENT',
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('409 when profile does not exist for authenticated user', async () => {
    mockSession.mockResolvedValue({
      user: { id: 'agent-a-uuid', role: 'consultant' },
    })
    // Contact is accessible (assigned to agent A)
    mockContactQuery.mockResolvedValue({
      data: { id: 1, assigned_to: 'agent-a-uuid' },
      error: null,
    })
    // But no profile row for agent A
    mockProfileQuery.mockResolvedValue({ data: null, error: { message: 'Not found' } })

    const { POST } = await import('@/app/api/mandates/route')
    const req = makeRequest('POST', 'http://localhost/api/mandates', {
      holder_contact_id: 1,
      transaction_mode: 'BUY',
      purpose: 'INVESTMENT',
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('profile')
  })

  it('owner_id is NOT accepted from client payload — always server-resolved', async () => {
    mockSession.mockResolvedValue({
      user: { id: 'real-agent-uuid', role: 'consultant' },
    })
    mockContactQuery.mockResolvedValue({
      data: { id: 1, assigned_to: 'real-agent-uuid' },
      error: null,
    })
    mockProfileQuery.mockResolvedValue({ data: { id: 'real-agent-uuid' }, error: null })
    mockRpc.mockResolvedValue({
      data: { ok: true, mandate_id: 'new-mandate-uuid' },
      error: null,
    })

    const { POST } = await import('@/app/api/mandates/route')
    const req = makeRequest('POST', 'http://localhost/api/mandates', {
      holder_contact_id: 1,
      transaction_mode: 'BUY',
      purpose: 'INVESTMENT',
      owner_id: 'attacker-uuid',  // client attempts mass-assignment
    })
    const res = await POST(req)

    if (res.status === 201) {
      // If it succeeded, verify the RPC was called with server's owner_id, not the attacker's
      const rpcCallArgs = mockRpc.mock.calls[0]
      const payload = rpcCallArgs[1]?.p_payload
      expect(payload?.owner_id).toBe('real-agent-uuid')
      expect(payload?.owner_id).not.toBe('attacker-uuid')
    } else {
      // Zod schema has .strict() — unknown field owner_id is rejected
      expect([400, 422]).toContain(res.status)
    }
  })

  it('422 for invalid input (missing required fields)', async () => {
    mockSession.mockResolvedValue({ user: { id: 'x', role: 'consultant' } })
    const { POST } = await import('@/app/api/mandates/route')
    const req = makeRequest('POST', 'http://localhost/api/mandates', {
      transaction_mode: 'BUY',
      // missing holder_contact_id and purpose
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
  })
})

// ── GET /api/mandates — IDOR ───────────────────────────────────────────────────

describe('GET /api/mandates — security', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 when no session', async () => {
    mockSession.mockResolvedValue(null)
    const { GET } = await import('@/app/api/mandates/route')
    const req = makeRequest('GET', 'http://localhost/api/mandates?contact_id=1')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('403 when agent tries to list mandates for another agent\'s contact', async () => {
    mockSession.mockResolvedValue({ user: { id: 'agent-a', role: 'consultant' } })
    mockContactQuery.mockResolvedValue({
      data: { id: 1, assigned_to: 'agent-b' },
      error: null,
    })
    const { GET } = await import('@/app/api/mandates/route')
    const req = makeRequest('GET', 'http://localhost/api/mandates?contact_id=1')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('400 for non-numeric contact_id', async () => {
    mockSession.mockResolvedValue({ user: { id: 'x', role: 'admin' } })
    const { GET } = await import('@/app/api/mandates/route')
    const req = makeRequest('GET', 'http://localhost/api/mandates?contact_id=abc')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})

// ── PATCH /api/mandates/[id] — mass-assignment protection ─────────────────────

describe('PATCH /api/mandates/[id] — security', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects unknown fields (strict schema)', async () => {
    mockSession.mockResolvedValue({ user: { id: 'owner-uuid', role: 'consultant' } })
    mockMandateQuery.mockResolvedValue({
      data: { id: 'mid', owner_id: 'owner-uuid', holder_contact_id: 1 },
      error: null,
    })

    const { PATCH } = await import('@/app/api/mandates/[id]/route')
    const req = makeRequest('PATCH', 'http://localhost/api/mandates/mid', {
      notes: 'Updated note',
      owner_id: 'attacker-uuid',        // must be rejected by strict schema
      holder_contact_id: 999,           // must be rejected
      lifecycle_state: 'CANCELLED',     // must be rejected (use lifecycle endpoint)
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'mid' }) })
    expect(res.status).toBe(422)
  })
})
