// =============================================================================
// Phase 2C.D2-B-DISCLOSURE-SAFETY-SR — Resend webhook handler tests
// POST /api/webhooks/resend
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/observability/correlation', () => ({
  getRequestCorrelationId: vi.fn(() => 'test-wh-corr'),
}))

const verifyMock = vi.fn()
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    webhooks: { verify: verifyMock },
  })),
}))

const mockSupabase = {
  from: vi.fn(),
}
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DELIVERY_ID   = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
const CONTACT_ID    = 42
const PROVIDER_ID   = 'resend-provider-abc123'

function makeSupabaseChain(resolvedValue: unknown) {
  const chain = {
    select:      vi.fn().mockReturnThis(),
    update:      vi.fn().mockReturnThis(),
    eq:          vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
  }
  return chain
}

function makeReq(body: string): NextRequest {
  return new NextRequest('http://localhost/api/webhooks/resend', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'svix-id':        'msg_test_001',
      'svix-timestamp': '1726828800',
      'svix-signature': 'v1,test_sig',
    },
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/webhooks/resend — auth', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 500 when RESEND_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET
    const { POST } = await import('@/app/api/webhooks/resend/route')
    const res = await POST(makeReq('{}'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/not configured/i)
  })

  it('returns 401 when svix signature is invalid', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test_secret'
    verifyMock.mockImplementation(() => { throw new Error('Invalid signature') })

    const { POST } = await import('@/app/api/webhooks/resend/route')
    const res = await POST(makeReq('{"type":"email.delivered","data":{}}'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/signature/i)
  })
})

describe('POST /api/webhooks/resend — email.delivered', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test_secret'
  })
  afterAll(() => { delete process.env.RESEND_WEBHOOK_SECRET })

  it('updates delivery_status to delivered for known email_id', async () => {
    verifyMock.mockReturnValue({
      type: 'email.delivered',
      data: { email_id: PROVIDER_ID, created_at: '2026-09-20T10:00:00Z' },
    })

    const chain = makeSupabaseChain({ data: { id: DELIVERY_ID, delivery_status: 'sent' }, error: null })
    mockSupabase.from = vi.fn().mockReturnValue(chain)

    const { POST } = await import('@/app/api/webhooks/resend/route')
    const res = await POST(makeReq('{}'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.event).toBe('email.delivered')
    expect(body.delivery_id).toBe(DELIVERY_ID)

    // update must have been called with delivered status
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ delivery_status: 'delivered' }),
    )
  })

  it('returns 200 matched:false for unknown email_id (non-disclosure email)', async () => {
    verifyMock.mockReturnValue({
      type: 'email.delivered',
      data: { email_id: 'unknown-id', created_at: '2026-09-20T10:00:00Z' },
    })

    const chain = makeSupabaseChain({ data: null, error: null })
    mockSupabase.from = vi.fn().mockReturnValue(chain)

    const { POST } = await import('@/app/api/webhooks/resend/route')
    const res = await POST(makeReq('{}'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.matched).toBe(false)
  })

  it('is idempotent — duplicate delivered event → no mutation', async () => {
    verifyMock.mockReturnValue({
      type: 'email.delivered',
      data: { email_id: PROVIDER_ID, created_at: '2026-09-20T10:00:00Z' },
    })

    // Delivery already in 'delivered' state
    const chain = makeSupabaseChain({ data: { id: DELIVERY_ID, delivery_status: 'delivered' }, error: null })
    mockSupabase.from = vi.fn().mockReturnValue(chain)

    const { POST } = await import('@/app/api/webhooks/resend/route')
    const res = await POST(makeReq('{}'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.idempotent).toBe(true)
    // No update call for already-delivered
    expect(chain.update).not.toHaveBeenCalled()
  })
})

describe('POST /api/webhooks/resend — email.bounced', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test_secret'
  })
  afterAll(() => { delete process.env.RESEND_WEBHOOK_SECRET })

  it('updates delivery_status to bounced — does NOT set gdpr_consent', async () => {
    verifyMock.mockReturnValue({
      type: 'email.bounced',
      data: { email_id: PROVIDER_ID, created_at: '2026-09-20T10:05:00Z' },
    })

    const deliveryChain = makeSupabaseChain({ data: { id: DELIVERY_ID, delivery_status: 'sent' }, error: null })
    mockSupabase.from = vi.fn().mockReturnValue(deliveryChain)

    const { POST } = await import('@/app/api/webhooks/resend/route')
    const res = await POST(makeReq('{}'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.event).toBe('email.bounced')

    // delivery_status must be 'bounced'
    expect(deliveryChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ delivery_status: 'bounced' }),
    )

    // BOUNCE ≠ CONSENT WITHDRAWAL — no contacts table update
    const fromCalls = (mockSupabase.from as ReturnType<typeof vi.fn>).mock.calls as string[][]
    const contactsUpdated = fromCalls.some(
      (args, i) => args[0] === 'contacts' &&
        ((mockSupabase.from as ReturnType<typeof vi.fn>).mock.results[i]?.value as { update?: ReturnType<typeof vi.fn> })?.update?.mock?.calls?.length > 0
    )
    expect(contactsUpdated).toBe(false)
  })
})

describe('POST /api/webhooks/resend — email.complained', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test_secret'
  })
  afterAll(() => { delete process.env.RESEND_WEBHOOK_SECRET })

  it('sets opt_out_marketing=true on complaint — does NOT set gdpr_consent=false', async () => {
    verifyMock.mockReturnValue({
      type: 'email.complained',
      data: { email_id: PROVIDER_ID, created_at: '2026-09-20T10:10:00Z' },
    })

    let contactsUpdatePayload: Record<string, unknown> | null = null

    const deliveryData = { id: DELIVERY_ID, contact_id: CONTACT_ID, delivery_status: 'delivered' }
    const deliveryChain = {
      select:      vi.fn().mockReturnThis(),
      update:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: deliveryData, error: null }),
    }
    const contactsChain = {
      update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        contactsUpdatePayload = payload
        return contactsChain
      }),
      eq:     vi.fn().mockReturnThis(),
    }

    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'contacts') return contactsChain
      return deliveryChain
    })

    const { POST } = await import('@/app/api/webhooks/resend/route')
    const res = await POST(makeReq('{}'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.event).toBe('email.complained')

    // opt_out_marketing must be set to true
    expect(contactsUpdatePayload).not.toBeNull()
    expect(contactsUpdatePayload!['opt_out_marketing']).toBe(true)

    // gdpr_consent must NOT be set (complaint ≠ consent withdrawal)
    expect(contactsUpdatePayload!['gdpr_consent']).toBeUndefined()
  })

  it('duplicate complaint → idempotent (no error)', async () => {
    verifyMock.mockReturnValue({
      type: 'email.complained',
      data: { email_id: PROVIDER_ID, created_at: '2026-09-20T10:10:00Z' },
    })

    const deliveryData = { id: DELIVERY_ID, contact_id: CONTACT_ID, delivery_status: 'delivered' }
    const deliveryChain = {
      select:      vi.fn().mockReturnThis(),
      update:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: deliveryData, error: null }),
    }
    const contactsChain = {
      update: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
    }
    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'contacts') return contactsChain
      return deliveryChain
    })

    const { POST } = await import('@/app/api/webhooks/resend/route')
    const res = await POST(makeReq('{}'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    // idempotent — no error on duplicate complaint
  })
})

describe('POST /api/webhooks/resend — unhandled event type', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test_secret'
  })
  afterAll(() => { delete process.env.RESEND_WEBHOOK_SECRET })

  it('returns 200 handled:false for unknown event type', async () => {
    verifyMock.mockReturnValue({
      type: 'email.clicked',
      data: { email_id: PROVIDER_ID },
    })

    mockSupabase.from = vi.fn().mockReturnValue(makeSupabaseChain({ data: null, error: null }))

    const { POST } = await import('@/app/api/webhooks/resend/route')
    const res = await POST(makeReq('{}'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.handled).toBe(false)
  })
})
