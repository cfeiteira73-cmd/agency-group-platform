// =============================================================================
// Phase 2C.D2-B-DISCLOSURE-SAFETY-SR — Admin reconciliation endpoint tests
// PATCH /api/admin/disclosure-deliveries/[id]/reconcile
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/observability/correlation', () => ({
  getRequestCorrelationId: vi.fn(() => 'test-rec-corr'),
}))

vi.mock('@/lib/requirePortalAuth', () => ({
  portalAuthGate: vi.fn(),
}))

vi.mock('@/lib/auth/commercialAuth', () => ({
  resolveActor: vi.fn(),
}))

const mockSupabase = {
  from: vi.fn(),
  rpc:  vi.fn(),
}
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

// ── Imports ───────────────────────────────────────────────────────────────────

import { portalAuthGate }     from '@/lib/requirePortalAuth'
import { resolveActor }       from '@/lib/auth/commercialAuth'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DELIVERY_ID = 'ffff0000-ffff-ffff-ffff-ffffffffffff'
const PACK_ID     = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const MATCH_ID    = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const CONTACT_ID  = 99
const ACTOR_ID    = 'dddddddd-dddd-dddd-dddd-dddddddddddd'

const adminActor = { id: ACTOR_ID, email: 'admin@agencygroup.pt', role: 'admin', isAdmin: true }
const agentActor = { id: ACTOR_ID, email: 'alice@agencygroup.pt', role: 'agent', isAdmin: false }

function makeGate(via: 'nextauth' | 'service_token', email = 'admin@agencygroup.pt') {
  return { authed: true, response: undefined as unknown as Response, email, via }
}

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost/api/admin/disclosure-deliveries/${DELIVERY_ID}/reconcile`, {
    method:  'PATCH',
    body:    JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const goodDelivery = {
  id:                   DELIVERY_ID,
  delivery_status:      'sending',
  pack_id:              PACK_ID,
  match_id:             MATCH_ID,
  contact_id:           CONTACT_ID,
  recipient_email:      'buyer@example.com',
  provider_message_id:  'resend-provider-abc',
  initiated_by:         ACTOR_ID,
  provider_response:    null,
}

function makeDeliveryChain(deliveryData: unknown) {
  return {
    select:      vi.fn().mockReturnThis(),
    update:      vi.fn().mockReturnThis(),
    eq:          vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: deliveryData, error: null }),
  }
}

// ── Auth boundary tests ───────────────────────────────────────────────────────

describe('PATCH /api/admin/.../reconcile — auth boundary', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('unauthenticated → response from gate', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue({
      authed: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      email: '',
      via: 'nextauth',
    })

    const { PATCH } = await import('@/app/api/admin/disclosure-deliveries/[id]/reconcile/route')
    const res = await PATCH(makeReq({ resolution: 'confirmed_sent', reason: 'evidence provided' }), { params: { id: DELIVERY_ID } })
    expect(res.status).toBe(401)
  })

  it('service_token → 403', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('service_token'))

    const { PATCH } = await import('@/app/api/admin/disclosure-deliveries/[id]/reconcile/route')
    const res = await PATCH(makeReq({ resolution: 'confirmed_sent', reason: 'evidence provided' }), { params: { id: DELIVERY_ID } })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/service token/i)
  })

  it('regular agent (non-admin) → 403', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })

    const { PATCH } = await import('@/app/api/admin/disclosure-deliveries/[id]/reconcile/route')
    const res = await PATCH(makeReq({ resolution: 'confirmed_sent', reason: 'evidence provided' }), { params: { id: DELIVERY_ID } })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/admin/i)
  })
})

// ── Body validation tests ─────────────────────────────────────────────────────

describe('PATCH /api/admin/.../reconcile — body validation', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: adminActor })
    mockSupabase.from = vi.fn().mockReturnValue(makeDeliveryChain(goodDelivery))
    mockSupabase.rpc  = vi.fn().mockResolvedValue({ data: { activity_id: 'act-001' }, error: null })
  })

  it('invalid resolution → 400', async () => {
    const { PATCH } = await import('@/app/api/admin/disclosure-deliveries/[id]/reconcile/route')
    const res = await PATCH(makeReq({ resolution: 'invalid_value', reason: 'some reason here' }), { params: { id: DELIVERY_ID } })
    expect(res.status).toBe(400)
  })

  it('missing reason → 400', async () => {
    const { PATCH } = await import('@/app/api/admin/disclosure-deliveries/[id]/reconcile/route')
    const res = await PATCH(makeReq({ resolution: 'confirmed_sent' }), { params: { id: DELIVERY_ID } })
    expect(res.status).toBe(400)
  })

  it('reason too short → 400', async () => {
    const { PATCH } = await import('@/app/api/admin/disclosure-deliveries/[id]/reconcile/route')
    const res = await PATCH(makeReq({ resolution: 'confirmed_sent', reason: 'ok' }), { params: { id: DELIVERY_ID } })
    expect(res.status).toBe(400)
  })
})

// ── State guard tests ─────────────────────────────────────────────────────────

describe('PATCH /api/admin/.../reconcile — delivery state guards', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: adminActor })
  })

  it('delivery not found → 404', async () => {
    mockSupabase.from = vi.fn().mockReturnValue(makeDeliveryChain(null))
    const { PATCH } = await import('@/app/api/admin/disclosure-deliveries/[id]/reconcile/route')
    const res = await PATCH(makeReq({ resolution: 'confirmed_sent', reason: 'evidence provided here' }), { params: { id: DELIVERY_ID } })
    expect(res.status).toBe(404)
  })

  it('delivery in terminal state "sent" → 409', async () => {
    const sentDelivery = { ...goodDelivery, delivery_status: 'sent' }
    mockSupabase.from = vi.fn().mockReturnValue(makeDeliveryChain(sentDelivery))
    const { PATCH } = await import('@/app/api/admin/disclosure-deliveries/[id]/reconcile/route')
    const res = await PATCH(makeReq({ resolution: 'confirmed_sent', reason: 'evidence provided here' }), { params: { id: DELIVERY_ID } })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.delivery_status).toBe('sent')
  })

  it('delivery in terminal state "delivered" → 409', async () => {
    const deliveredDelivery = { ...goodDelivery, delivery_status: 'delivered' }
    mockSupabase.from = vi.fn().mockReturnValue(makeDeliveryChain(deliveredDelivery))
    const { PATCH } = await import('@/app/api/admin/disclosure-deliveries/[id]/reconcile/route')
    const res = await PATCH(makeReq({ resolution: 'confirmed_sent', reason: 'evidence provided here' }), { params: { id: DELIVERY_ID } })
    expect(res.status).toBe(409)
  })
})

// ── confirmed_sent tests ──────────────────────────────────────────────────────

describe('PATCH /api/admin/.../reconcile — confirmed_sent', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: adminActor })
  })

  it('calls finalize_deal_pack_email_disclosure RPC with correct params — 0 provider calls', async () => {
    const deliveryChain = makeDeliveryChain(goodDelivery)
    mockSupabase.from = vi.fn().mockReturnValue(deliveryChain)
    const rpcMock = vi.fn().mockResolvedValue({ data: { activity_id: 'act-reconcile-001' }, error: null })
    mockSupabase.rpc = rpcMock

    const { PATCH } = await import('@/app/api/admin/disclosure-deliveries/[id]/reconcile/route')
    const res = await PATCH(
      makeReq({ resolution: 'confirmed_sent', reason: 'Resend dashboard confirms delivery on 2026-09-20' }),
      { params: { id: DELIVERY_ID } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.resolution).toBe('confirmed_sent')
    expect(body.delivery_id).toBe(DELIVERY_ID)
    expect(body.provider_message_id).toBe('resend-provider-abc')
    expect(body.activity_id).toBe('act-reconcile-001')

    // finalize RPC must have been called
    expect(rpcMock).toHaveBeenCalledWith('finalize_deal_pack_email_disclosure', expect.objectContaining({
      p_delivery_id:     DELIVERY_ID,
      p_pack_id:         PACK_ID,
      p_match_id:        MATCH_ID,
      p_contact_id:      CONTACT_ID,
      p_actor_id:        ACTOR_ID,
      p_recipient_email: 'buyer@example.com',
      p_provider_msg_id: 'resend-provider-abc',
    }))
  })

  it('confirmed_sent with body-supplied provider_message_id overrides delivery value', async () => {
    const deliveryNoProviderId = { ...goodDelivery, provider_message_id: null }
    const deliveryChain = makeDeliveryChain(deliveryNoProviderId)
    mockSupabase.from = vi.fn().mockReturnValue(deliveryChain)
    const rpcMock = vi.fn().mockResolvedValue({ data: { activity_id: 'act-override-001' }, error: null })
    mockSupabase.rpc = rpcMock

    const { PATCH } = await import('@/app/api/admin/disclosure-deliveries/[id]/reconcile/route')
    const res = await PATCH(
      makeReq({ resolution: 'confirmed_sent', reason: 'provider id from Resend support ticket', provider_message_id: 'resend-support-override' }),
      { params: { id: DELIVERY_ID } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.provider_message_id).toBe('resend-support-override')

    expect(rpcMock).toHaveBeenCalledWith('finalize_deal_pack_email_disclosure', expect.objectContaining({
      p_provider_msg_id: 'resend-support-override',
    }))
  })

  it('confirmed_sent without any provider_message_id → 400', async () => {
    const deliveryNoProviderId = { ...goodDelivery, provider_message_id: null }
    mockSupabase.from = vi.fn().mockReturnValue(makeDeliveryChain(deliveryNoProviderId))
    mockSupabase.rpc  = vi.fn()

    const { PATCH } = await import('@/app/api/admin/disclosure-deliveries/[id]/reconcile/route')
    const res = await PATCH(
      makeReq({ resolution: 'confirmed_sent', reason: 'attempting without provider id' }),
      { params: { id: DELIVERY_ID } },
    )
    expect(res.status).toBe(400)
    // RPC must NOT have been called (no provider id = can't finalize safely)
    expect(mockSupabase.rpc).not.toHaveBeenCalled()
  })
})

// ── confirmed_failed tests ────────────────────────────────────────────────────

describe('PATCH /api/admin/.../reconcile — confirmed_failed', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: adminActor })
  })

  it('marks delivery as failed (retryable) — no RPC, no email sent', async () => {
    const deliveryChain = makeDeliveryChain({ ...goodDelivery, delivery_status: 'unknown' })
    mockSupabase.from = vi.fn().mockReturnValue(deliveryChain)
    const rpcMock = vi.fn()
    mockSupabase.rpc = rpcMock

    const { PATCH } = await import('@/app/api/admin/disclosure-deliveries/[id]/reconcile/route')
    const res = await PATCH(
      makeReq({ resolution: 'confirmed_failed', reason: 'Resend support confirmed no delivery event — provider rejected' }),
      { params: { id: DELIVERY_ID } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.resolution).toBe('confirmed_failed')
    expect(body.retryable).toBe(true)

    // delivery must be updated to 'failed'
    expect(deliveryChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ delivery_status: 'failed' }),
    )

    // finalize RPC must NOT be called
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
