// =============================================================================
// Phase 2C.D2-B-DEALPACK-AUTH — deal pack authorization boundary tests
// Tests §39–§54: object-level authorization on all deal-pack routes
//
// Pattern: pure logic — vi.mock for all external dependencies, no DB, no network
// Auth model: service_token → 403, inactive/NULL-active → 403 (failClosed),
//   cross-agent → 403, owner → pass, admin → pass
//
// GENERATION ≠ DISCLOSURE — verified by scope boundary tests
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Auth mocks ───────────────────────────────────────────────────────────────

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/requirePortalAuth', () => ({
  portalAuthGate: vi.fn(),
}))

vi.mock('@/lib/auth/commercialAuth', () => ({
  resolveActor: vi.fn(),
  checkDealPackOwnership: vi.fn(),
  checkMatchOwnership: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}))

vi.mock('@/lib/observability/correlation', () => ({
  getRequestCorrelationId: vi.fn(() => 'test-corr-id'),
}))

vi.mock('@/lib/database.types', () => ({}))

// ── Helpers ──────────────────────────────────────────────────────────────────

import { portalAuthGate } from '@/lib/requirePortalAuth'
import { resolveActor, checkDealPackOwnership, checkMatchOwnership } from '@/lib/auth/commercialAuth'

const PACK_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const MATCH_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

function makeGate(via: 'nextauth' | 'magic_link' | 'service_token', email = 'agent@test.com') {
  return { authed: true, response: undefined as unknown as Response, email, via }
}

const adminActor  = { id: 'admin-id', email: 'admin@test.com', role: 'admin', isAdmin: true }
const agentActor  = { id: 'agent-id', email: 'alice@test.com', role: 'agent', isAdmin: false }

function makeRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  })
}

// ── LIST route ───────────────────────────────────────────────────────────────

describe('GET /api/deal-packs — list', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('§42 service_token → 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('service_token'))

    const { GET } = await import('@/app/api/deal-packs/route')
    const res = await GET(makeRequest('GET', '/api/deal-packs'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.toLowerCase()).toContain('service token')
  })

  it('§44 NULL is_active → 403 (failClosed)', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'null-active@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: false, status: 403, error: 'Agent account inactive — commercial mutations require an active account' })

    const { GET } = await import('@/app/api/deal-packs/route')
    const res = await GET(makeRequest('GET', '/api/deal-packs'))
    expect(res.status).toBe(403)
  })

  it('§45 unknown user → 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'ghost@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: false, status: 403, error: 'Authenticated user not found in public.users — human actor required' })

    const { GET } = await import('@/app/api/deal-packs/route')
    const res = await GET(makeRequest('GET', '/api/deal-packs'))
    expect(res.status).toBe(403)
  })

  it('§40 owner lists own packs → 200 (no 403)', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'alice@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })

    const { GET } = await import('@/app/api/deal-packs/route')
    const res = await GET(makeRequest('GET', '/api/deal-packs'))
    expect(res.status).not.toBe(403)
  })

  it('§41 admin lists all packs → 200 (no 403)', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'admin@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: adminActor })

    const { GET } = await import('@/app/api/deal-packs/route')
    const res = await GET(makeRequest('GET', '/api/deal-packs'))
    expect(res.status).not.toBe(403)
  })
})

// ── [id] GET route ───────────────────────────────────────────────────────────

describe('GET /api/deal-packs/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('§42 service_token → 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('service_token'))

    const { GET } = await import('@/app/api/deal-packs/[id]/route')
    const res = await GET(makeRequest('GET', `/api/deal-packs/${PACK_ID}`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(403)
  })

  it('§39 cross-agent GET → 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkDealPackOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'bob@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: { id: 'bob-id', email: 'bob@test.com', role: 'agent', isAdmin: false } })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: false, status: 403, error: 'Not authorized — this deal pack belongs to another agent' })

    const { GET } = await import('@/app/api/deal-packs/[id]/route')
    const res = await GET(makeRequest('GET', `/api/deal-packs/${PACK_ID}`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('another agent')
  })

  it('§39 pack not found → 404', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkDealPackOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'alice@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: false, status: 404, error: 'Deal pack not found' })

    const { GET } = await import('@/app/api/deal-packs/[id]/route')
    const res = await GET(makeRequest('GET', `/api/deal-packs/${PACK_ID}`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(404)
  })

  it('§40 owner GET → ownership gate passes (not 403)', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkDealPackOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'alice@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const { GET } = await import('@/app/api/deal-packs/[id]/route')
    const res = await GET(makeRequest('GET', `/api/deal-packs/${PACK_ID}`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).not.toBe(403)
  })
})

// ── [id] PATCH route ─────────────────────────────────────────────────────────

describe('PATCH /api/deal-packs/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('§42 service_token → 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('service_token'))

    const { PATCH } = await import('@/app/api/deal-packs/[id]/route')
    const res = await PATCH(makeRequest('PATCH', `/api/deal-packs/${PACK_ID}`, { status: 'ready' }), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(403)
  })

  it('§50 cross-agent PATCH → 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkDealPackOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'bob@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: { id: 'bob-id', email: 'bob@test.com', role: 'agent', isAdmin: false } })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: false, status: 403, error: 'Not authorized — this deal pack belongs to another agent' })

    const { PATCH } = await import('@/app/api/deal-packs/[id]/route')
    const res = await PATCH(makeRequest('PATCH', `/api/deal-packs/${PACK_ID}`, { status: 'ready' }), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(403)
  })

  it('§47 PATCH status=sent → 422 (requires actual transport)', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkDealPackOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'alice@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const { PATCH } = await import('@/app/api/deal-packs/[id]/route')
    const res = await PATCH(makeRequest('PATCH', `/api/deal-packs/${PACK_ID}`, { status: 'sent' }), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toContain('sent')
    expect(body.error).toContain('transport')
  })

  it('§51 owner PATCH status=archived → ownership gate passes (not 403)', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkDealPackOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'alice@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const { PATCH } = await import('@/app/api/deal-packs/[id]/route')
    const res = await PATCH(makeRequest('PATCH', `/api/deal-packs/${PACK_ID}`, { status: 'archived' }), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).not.toBe(403)
  })

  it('§43 inactive user → 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'inactive@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: false, status: 403, error: 'Agent account inactive — commercial mutations require an active account' })

    const { PATCH } = await import('@/app/api/deal-packs/[id]/route')
    const res = await PATCH(makeRequest('PATCH', `/api/deal-packs/${PACK_ID}`, { status: 'ready' }), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('inactive')
  })
})

// ── [id] DELETE route ────────────────────────────────────────────────────────

describe('DELETE /api/deal-packs/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('§42 service_token → 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('service_token'))

    const { DELETE } = await import('@/app/api/deal-packs/[id]/route')
    const res = await DELETE(makeRequest('DELETE', `/api/deal-packs/${PACK_ID}`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(403)
  })

  it('§48 cross-agent DELETE → 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkDealPackOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'bob@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: { id: 'bob-id', email: 'bob@test.com', role: 'agent', isAdmin: false } })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: false, status: 403, error: 'Not authorized — this deal pack belongs to another agent' })

    const { DELETE } = await import('@/app/api/deal-packs/[id]/route')
    const res = await DELETE(makeRequest('DELETE', `/api/deal-packs/${PACK_ID}`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(403)
  })

  it('§49 owner DELETE → ownership gate passes (not 403)', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkDealPackOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'alice@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const { DELETE } = await import('@/app/api/deal-packs/[id]/route')
    const res = await DELETE(makeRequest('DELETE', `/api/deal-packs/${PACK_ID}`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).not.toBe(403)
  })

  it('§41 admin DELETE any pack → ownership gate passes', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkDealPackOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'admin@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: adminActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const { DELETE } = await import('@/app/api/deal-packs/[id]/route')
    const res = await DELETE(makeRequest('DELETE', `/api/deal-packs/${PACK_ID}`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).not.toBe(403)
  })
})

// ── checkDealPackOwnership unit tests ────────────────────────────────────────
// Uses vi.importActual to bypass the top-level mock and get the real implementation.

import type { SupabaseClient } from '@supabase/supabase-js'

function makePackSupabase(
  packRow: Record<string, unknown> | null,
  contactRow: Record<string, unknown> | null = null,
): SupabaseClient {
  const packSingle = vi.fn().mockResolvedValue({ data: packRow, error: packRow ? null : { message: 'not found' } })
  const contactSingle = vi.fn().mockResolvedValue({ data: contactRow, error: contactRow ? null : { message: 'not found' } })
  return {
    from: vi.fn((table: string) => {
      if (table === 'deal_packs') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: packSingle }) }) }
      if (table === 'contacts')   return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: contactSingle }) }) }
      return {}
    }),
  } as unknown as SupabaseClient
}

function makeUserSupabase(row: Record<string, unknown> | null): SupabaseClient {
  const single = vi.fn().mockResolvedValue({ data: row, error: row ? null : { message: 'not found' } })
  return {
    from: vi.fn(() => ({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }) })),
  } as unknown as SupabaseClient
}

describe('checkDealPackOwnership unit', () => {
  it('§39 pack not found → 404', async () => {
    const { checkDealPackOwnership } = await vi.importActual<typeof import('@/lib/auth/commercialAuth')>('@/lib/auth/commercialAuth')
    const sb = makePackSupabase(null)
    const res = await checkDealPackOwnership(agentActor, PACK_ID, sb)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(404)
  })

  it('§41 admin → always ok', async () => {
    const { checkDealPackOwnership } = await vi.importActual<typeof import('@/lib/auth/commercialAuth')>('@/lib/auth/commercialAuth')
    const sb = makePackSupabase({ id: PACK_ID, created_by: 'alice@test.com', lead_id: null })
    const res = await checkDealPackOwnership(adminActor, PACK_ID, sb)
    expect(res.ok).toBe(true)
  })

  it('§40 creator == actor → ok', async () => {
    const { checkDealPackOwnership } = await vi.importActual<typeof import('@/lib/auth/commercialAuth')>('@/lib/auth/commercialAuth')
    const sb = makePackSupabase({ id: PACK_ID, created_by: 'alice@test.com', lead_id: null })
    const res = await checkDealPackOwnership(agentActor, PACK_ID, sb)
    expect(res.ok).toBe(true)
  })

  it('§39 cross-agent (created_by = other, no lead) → 403', async () => {
    const { checkDealPackOwnership } = await vi.importActual<typeof import('@/lib/auth/commercialAuth')>('@/lib/auth/commercialAuth')
    const sb = makePackSupabase({ id: PACK_ID, created_by: 'bob@test.com', lead_id: null })
    const res = await checkDealPackOwnership(agentActor, PACK_ID, sb)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(403)
  })

  it('§40 contact owner (different creator) → ok', async () => {
    const { checkDealPackOwnership } = await vi.importActual<typeof import('@/lib/auth/commercialAuth')>('@/lib/auth/commercialAuth')
    const sb = makePackSupabase(
      { id: PACK_ID, created_by: 'bob@test.com', lead_id: 'lead-uuid' },
      { agent_email: 'alice@test.com' }
    )
    const res = await checkDealPackOwnership(agentActor, PACK_ID, sb)
    expect(res.ok).toBe(true)
  })

  it('§39 cross-agent (created_by = other, contact assigned to other) → 403', async () => {
    const { checkDealPackOwnership } = await vi.importActual<typeof import('@/lib/auth/commercialAuth')>('@/lib/auth/commercialAuth')
    const sb = makePackSupabase(
      { id: PACK_ID, created_by: 'bob@test.com', lead_id: 'lead-uuid' },
      { agent_email: 'carol@test.com' }
    )
    const res = await checkDealPackOwnership(agentActor, PACK_ID, sb)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(403)
  })
})

// ── resolveActor failClosed unit tests ───────────────────────────────────────

describe('resolveActor failClosed option', () => {
  it('§44 is_active=NULL + failClosed=false → active (default)', async () => {
    const { resolveActor: resolveActorReal } = await vi.importActual<typeof import('@/lib/auth/commercialAuth')>('@/lib/auth/commercialAuth')
    const sb = makeUserSupabase({ id: 'u1', role: 'agent', is_active: null })
    const res = await resolveActorReal('agent@test.com', sb)
    expect(res.ok).toBe(true)
  })

  it('§44 is_active=NULL + failClosed=true → denied', async () => {
    const { resolveActor: resolveActorReal } = await vi.importActual<typeof import('@/lib/auth/commercialAuth')>('@/lib/auth/commercialAuth')
    const sb = makeUserSupabase({ id: 'u1', role: 'agent', is_active: null })
    const res = await resolveActorReal('agent@test.com', sb, { failClosed: true })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.status).toBe(403)
      expect(res.error).toContain('inactive')
    }
  })

  it('§43 is_active=false + failClosed=true → denied', async () => {
    const { resolveActor: resolveActorReal } = await vi.importActual<typeof import('@/lib/auth/commercialAuth')>('@/lib/auth/commercialAuth')
    const sb = makeUserSupabase({ id: 'u1', role: 'agent', is_active: false })
    const res = await resolveActorReal('agent@test.com', sb, { failClosed: true })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(403)
  })

  it('§43 is_active=true + failClosed=true → active', async () => {
    const { resolveActor: resolveActorReal } = await vi.importActual<typeof import('@/lib/auth/commercialAuth')>('@/lib/auth/commercialAuth')
    const sb = makeUserSupabase({ id: 'u1', role: 'agent', is_active: true })
    const res = await resolveActorReal('agent@test.com', sb, { failClosed: true })
    expect(res.ok).toBe(true)
  })
})

// ── generate route tests ─────────────────────────────────────────────────────

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: { create: vi.fn() },
  })),
}))

vi.mock('@/lib/ops/withAI', () => ({
  withAI: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/trackLearningEvent', () => ({
  default: {
    dealPackGenerated: vi.fn(),
    dealPackSent: vi.fn(),
  },
}))

vi.mock('@/lib/observability/causalTrace', () => ({
  recordCausalStep: vi.fn(),
}))

describe('POST /api/deal-packs/generate', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('§42 service_token → 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('service_token'))

    const { POST } = await import('@/app/api/deal-packs/generate/route')
    const res = await POST(makeRequest('POST', '/api/deal-packs/generate', { property_data: { price: 500000 } }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.toLowerCase()).toContain('service token')
  })

  it('§43 inactive → 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'inactive@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: false, status: 403, error: 'Agent account inactive — commercial mutations require an active account' })

    const { POST } = await import('@/app/api/deal-packs/generate/route')
    const res = await POST(makeRequest('POST', '/api/deal-packs/generate', { property_data: { price: 500000 } }))
    expect(res.status).toBe(403)
  })

  it('§46 unassigned contact + non-admin in generate → 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkMatchOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'alice@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkMatchOwnership).mockResolvedValue({ ok: false, status: 403, error: 'Contact is unassigned — only admin may perform commercial actions on unassigned contacts' })

    const { POST } = await import('@/app/api/deal-packs/generate/route')
    const res = await POST(makeRequest('POST', '/api/deal-packs/generate', {
      lead_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      property_data: { price: 500000 },
    }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('unassigned')
  })

  it('§52 match_id provided: unauthorized match → 403', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor, checkMatchOwnership } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'alice@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    // checkMatchOwnership will return 403 for cross-agent match
    vi.mocked(checkMatchOwnership).mockResolvedValue({ ok: false, status: 403, error: 'Not authorized — this contact belongs to another agent' })

    const { createClient } = await import('@supabase/supabase-js')
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'matches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: MATCH_ID, lead_id: 'lead-uuid', disclosure_status: 'authorized' },
                  error: null,
                }),
              }),
            }),
          }
        }
        return { from: vi.fn() }
      }),
    } as unknown as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/generate/route')
    const res = await POST(makeRequest('POST', '/api/deal-packs/generate', {
      match_id: MATCH_ID,
      property_data: { price: 500000 },
    }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('another agent')
  })

  it('§53 match_id provided: disclosure not authorized → 422', async () => {
    const { portalAuthGate } = await import('@/lib/requirePortalAuth')
    const { resolveActor } = await import('@/lib/auth/commercialAuth')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'alice@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })

    const { createClient } = await import('@supabase/supabase-js')
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'matches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: MATCH_ID, lead_id: 'lead-uuid', disclosure_status: 'pending' },
                  error: null,
                }),
              }),
            }),
          }
        }
        return { from: vi.fn() }
      }),
    } as unknown as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/generate/route')
    const res = await POST(makeRequest('POST', '/api/deal-packs/generate', {
      match_id: MATCH_ID,
      property_data: { price: 500000 },
    }))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toContain('authorized')
  })
})
