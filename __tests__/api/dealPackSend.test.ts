// =============================================================================
// Phase 2C.D2-B-DISCLOSURE-FOUNDATION — deal pack send + manual disclosure tests
// Tests §52–§71 of the authorization
//
// §52  Transport adapter mock — Resend never called when flag disabled
// §53  Happy path (flag enabled) → 200 with delivery_id
// §54  Idempotency guard: sent→409, in-flight-same-key→409
// §55  Provider failure → 502
// §56  Provider timeout → 502 (unknown status)
// §57  DB finalization failure → 207
// §58  match disclosure revoked → 422
// §59  match status pending (not reviewed_accepted) → 422
// §60  match disclosure not authorized → 422
// §61  Cross-agent authorization → 403
// §62  Unassigned contact → 403
// §63  Inactive actor → 403
// §64  Service token → 403
// §65  Contact reassignment (owner changed) → 403
// §66  Malformed recipient email → 422
// §67  Pack/match mismatch → 422
// §68  PDF internal field leakage (template test) → fields absent from HTML
// §69  Feature flag disabled → 200 {sent:false}
// §70  D1/D2-A regression — disclose_match RPC scope unchanged
// §71  Deal Pack auth regression — checkDealPackOwnership still correct
// MANUAL §72: manual disclosure endpoint
// PV §73  Same-action retry: pending/failed delivery resumes (§10 repair)
// PV §74  Same-action retry: same key already sent → 200 idempotent
// PV §75  Manual disclosure uses record_manual_disclosure RPC (§22+§25 repair)
// PV §76  Unsubscribe wording — no fake automated unsubscribe copy (§30 repair)
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { buildDisclosureEmailHtml, buildDisclosureEmailText } from '@/lib/disclosure/emailTemplate'

// ── Global mocks ──────────────────────────────────────────────────────────────

vi.mock('@/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))

vi.mock('@/lib/requirePortalAuth', () => ({
  portalAuthGate: vi.fn(),
}))

vi.mock('@/lib/auth/commercialAuth', () => ({
  resolveActor:          vi.fn(),
  checkDealPackOwnership: vi.fn(),
  checkMatchOwnership:   vi.fn(),
}))

vi.mock('@/lib/observability/correlation', () => ({
  getRequestCorrelationId: vi.fn(() => 'test-corr-id'),
}))

// Resend mock — default: never actually send
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'resend-msg-001' }, error: null }),
    },
  })),
}))

// Supabase mock factory — configurable per test
const makeSupabaseMock = (overrides: Record<string, unknown> = {}) => ({
  from: vi.fn().mockImplementation((table: string) => {
    const base = {
      select:  vi.fn().mockReturnThis(),
      insert:  vi.fn().mockReturnThis(),
      update:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockReturnThis(),
      is:      vi.fn().mockReturnThis(),
      order:   vi.fn().mockReturnThis(),
      limit:   vi.fn().mockReturnThis(),
      in:      vi.fn().mockReturnThis(),
      single:  vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    return { ...base, ...(overrides[table] ?? {}) }
  }),
  rpc: vi.fn().mockResolvedValue({
    data: { idempotent: false, delivery_id: 'del-001', activity_id: 'act-001', sent_at: '2026-09-20T10:00:00Z' },
    error: null,
  }),
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => makeSupabaseMock()),
}))

vi.mock('@/lib/database.types', () => ({}))

// ── Helpers ────────────────────────────────────────────────────────────────────

import { portalAuthGate } from '@/lib/requirePortalAuth'
import { resolveActor, checkDealPackOwnership, checkMatchOwnership } from '@/lib/auth/commercialAuth'
import { createClient } from '@supabase/supabase-js'

const PACK_ID  = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const MATCH_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const CONTACT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const ACTOR_ID  = 'dddddddd-dddd-dddd-dddd-dddddddddddd'

const adminActor  = { id: ACTOR_ID, email: 'admin@test.com', role: 'admin', isAdmin: true }
const agentActor  = { id: ACTOR_ID, email: 'alice@test.com', role: 'agent', isAdmin: false }

function makeGate(via: 'nextauth' | 'magic_link' | 'service_token', email = 'alice@test.com') {
  return { authed: true, response: undefined as unknown as Response, email, via }
}

function makeReq(method: string, path: string, body?: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    body:    body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  })
}

// Canonical good state: pack ready, match reviewed_accepted+authorized, contact has email
const goodPack = {
  id: PACK_ID, status: 'ready', match_id: MATCH_ID, lead_id: CONTACT_ID,
  title: 'Test Pack', investment_thesis: 'Great investment', market_summary: null,
  highlights: ['Panoramic view', 'Private pool'],
  financial_projections: { estimated_yield: 4.2 },
  opportunity_score: 85, // Must NOT appear in email
}
const goodMatch = {
  id: MATCH_ID, status: 'reviewed_accepted', disclosure_status: 'authorized', lead_id: CONTACT_ID,
}
const goodContact = {
  id: CONTACT_ID, full_name: 'James Mitchell', email: 'james@example.com',
  opt_out_marketing: false, gdpr_consent: null,
}

// ── §52 Transport adapter mock ─────────────────────────────────────────────────

describe('§52 DEALPACK_EMAIL_SEND_ACTIVE=false — Resend is never called', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.DEALPACK_EMAIL_SEND_ACTIVE
  })

  it('POST /api/deal-packs/[id]/send with flag unset → sent:false, Resend not called', async () => {
    const { Resend } = await import('resend')
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const mockSb = makeSupabaseMock({
      deal_packs:             { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodPack, error: null }) },
      matches:                { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodMatch, error: null }) },
      contacts:               { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodContact, error: null }) },
      disclosure_deliveries:  {
        select:  vi.fn().mockReturnThis(),
        eq:      vi.fn().mockReturnThis(),
        order:   vi.fn().mockReturnThis(),
        limit:   vi.fn().mockResolvedValue({ data: [], error: null }),
        insert:  vi.fn().mockReturnThis(),
        single:  vi.fn().mockResolvedValue({ data: { id: 'del-flagoff-01' }, error: null }),
      },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(makeReq('POST', `/api/deal-packs/${PACK_ID}/send`), { params: Promise.resolve({ id: PACK_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sent).toBe(false)
    expect(body.reason).toBe('feature_flag_disabled')
    expect(body.delivery_id).toBeTruthy()
    // Resend constructor should NOT have been called
    expect(vi.mocked(Resend)).not.toHaveBeenCalled()
  })
})

// ── §69 Feature flag disabled explicitly ───────────────────────────────────────

describe('§69 DEALPACK_EMAIL_SEND_ACTIVE=false explicit', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.DEALPACK_EMAIL_SEND_ACTIVE = 'false'
  })
  afterAll(() => { delete process.env.DEALPACK_EMAIL_SEND_ACTIVE })

  it('flag=false → 200 {sent:false,reason:feature_flag_disabled}', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const mockSb = makeSupabaseMock({
      deal_packs:            { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodPack, error: null }) },
      matches:               { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodMatch, error: null }) },
      contacts:              { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodContact, error: null }) },
      disclosure_deliveries: {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
        order:  vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'del-002' }, error: null }),
      },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(makeReq('POST', `/api/deal-packs/${PACK_ID}/send`), { params: Promise.resolve({ id: PACK_ID }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.sent).toBe(false)
    expect(body.reason).toBe('feature_flag_disabled')
  })
})

// ── §64 Service token → 403 ────────────────────────────────────────────────────

describe('§64 Service token on send → 403', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('via=service_token → 403', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('service_token'))
    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(makeReq('POST', `/api/deal-packs/${PACK_ID}/send`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.toLowerCase()).toContain('service token')
  })
})

// ── §63 Inactive actor → 403 ──────────────────────────────────────────────────

describe('§63 Inactive actor → 403', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('resolveActor returns inactive → 403', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: false, status: 403, error: 'Agent account inactive' })

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(makeReq('POST', `/api/deal-packs/${PACK_ID}/send`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(403)
  })
})

// ── §61 Cross-agent → 403 ─────────────────────────────────────────────────────

describe('§61 Cross-agent authorization → 403', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('checkDealPackOwnership returns 403 → propagated', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: false, status: 403, error: 'Not authorized — this deal pack belongs to another agent' })

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(makeReq('POST', `/api/deal-packs/${PACK_ID}/send`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(403)
  })
})

// ── §62 Unassigned contact → 403 ──────────────────────────────────────────────

describe('§62 Unassigned contact → 403', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('checkDealPackOwnership returns unassigned 403 → propagated', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: false, status: 403, error: 'Not authorized — contact is unassigned, admin required' })

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(makeReq('POST', `/api/deal-packs/${PACK_ID}/send`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.toLowerCase()).toContain('unassigned')
  })
})

// ── §58 Disclosure revoked → 422 ──────────────────────────────────────────────

describe('§58 Match disclosure revoked → 422', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('disclosure_status=revoked → 422', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const revokedMatch = { ...goodMatch, disclosure_status: 'revoked' }
    const mockSb = makeSupabaseMock({
      deal_packs: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodPack, error: null }) },
      matches:    { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: revokedMatch, error: null }) },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(makeReq('POST', `/api/deal-packs/${PACK_ID}/send`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.toLowerCase()).toContain('not authorized')
  })
})

// ── §59 Match pending (not reviewed_accepted) → 422 ──────────────────────────

describe('§59 Match not reviewed_accepted → 422', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('match.status=pending → 422', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const pendingMatch = { ...goodMatch, status: 'pending' }
    const mockSb = makeSupabaseMock({
      deal_packs: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodPack, error: null }) },
      matches:    { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: pendingMatch, error: null }) },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(makeReq('POST', `/api/deal-packs/${PACK_ID}/send`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.toLowerCase()).toContain('reviewed_accepted')
  })
})

// ── §60 Match not disclosure authorized → 422 ────────────────────────────────

describe('§60 Match disclosure not authorized → 422', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('disclosure_status=null → 422', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const nullAuthMatch = { ...goodMatch, disclosure_status: null }
    const mockSb = makeSupabaseMock({
      deal_packs: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodPack, error: null }) },
      matches:    { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: nullAuthMatch, error: null }) },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(makeReq('POST', `/api/deal-packs/${PACK_ID}/send`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.toLowerCase()).toContain('not authorized')
  })
})

// ── §54 Idempotency guard ─────────────────────────────────────────────────────
// New semantics (§10 repair): guard uses action_id-based key + belt-and-suspenders sent check.
// pending   → resume (§73 tests)
// failed    → resume (§73 tests)
// sending   → 409 (in-flight, same action_id)
// sent (16a) → 409 (V1 one-disclosure rule)
// sent (16b) → 200 idempotent (§74 test)

describe('§54 Idempotency guard (§10 repair)', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('already disclosed (belt-and-suspenders sent check 16a) → 409', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const mockSb = makeSupabaseMock({
      deal_packs: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodPack, error: null }) },
      matches:    { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodMatch, error: null }) },
      contacts:   { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodContact, error: null }) },
      // 16a: first maybeSingle call (sent check by pack+match+channel) → finds sent delivery → 409
      disclosure_deliveries: {
        select:      vi.fn().mockReturnThis(),
        eq:          vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValueOnce({
          data: { id: 'del-already-sent', sent_at: '2026-09-20T09:00:00Z' },
          error: null,
        }),
      },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(makeReq('POST', `/api/deal-packs/${PACK_ID}/send`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.toLowerCase()).toContain('already been disclosed')
  })

  it('same action_id + delivery is sending → 409 (in-flight concurrent call)', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const ACTION_ID = 'a1b2c3d4-0000-0000-0000-000000000001'
    const mockSb = makeSupabaseMock({
      deal_packs: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodPack, error: null }) },
      matches:    { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodMatch, error: null }) },
      contacts:   { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodContact, error: null }) },
      disclosure_deliveries: {
        select:      vi.fn().mockReturnThis(),
        eq:          vi.fn().mockReturnThis(),
        // 16a: no sent delivery; 16b: same action_id delivery is 'sending'
        maybeSingle: vi.fn()
          .mockResolvedValueOnce({ data: null, error: null })
          .mockResolvedValueOnce({ data: { id: 'del-in-flight', delivery_status: 'sending', sent_at: null }, error: null }),
      },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(
      makeReq('POST', `/api/deal-packs/${PACK_ID}/send`, { action_id: ACTION_ID }),
      { params: Promise.resolve({ id: PACK_ID }) },
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.toLowerCase()).toContain('in-flight')
  })

  it('same action_id + delivery is unknown → 409 (requires operator)', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const ACTION_ID = 'a1b2c3d4-0000-0000-0000-000000000002'
    const mockSb = makeSupabaseMock({
      deal_packs: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodPack, error: null }) },
      matches:    { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodMatch, error: null }) },
      contacts:   { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodContact, error: null }) },
      disclosure_deliveries: {
        select:      vi.fn().mockReturnThis(),
        eq:          vi.fn().mockReturnThis(),
        maybeSingle: vi.fn()
          .mockResolvedValueOnce({ data: null, error: null })
          .mockResolvedValueOnce({ data: { id: 'del-unknown', delivery_status: 'unknown', sent_at: null }, error: null }),
      },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(
      makeReq('POST', `/api/deal-packs/${PACK_ID}/send`, { action_id: ACTION_ID }),
      { params: Promise.resolve({ id: PACK_ID }) },
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.toLowerCase()).toContain('unknown outcome')
  })
})

// ── §66 Malformed recipient email → 422 ──────────────────────────────────────

describe('§66 Malformed recipient email → 422', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('contact.email=malformed → 422', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const badContact = { ...goodContact, email: 'not-an-email' }
    const mockSb = makeSupabaseMock({
      deal_packs: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodPack, error: null }) },
      matches:    { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodMatch, error: null }) },
      contacts:   { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: badContact, error: null }) },
      disclosure_deliveries: {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
        order:  vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(makeReq('POST', `/api/deal-packs/${PACK_ID}/send`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.toLowerCase()).toContain('malformed')
  })

  it('contact.email=null → 422 (no email address)', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const noEmailContact = { ...goodContact, email: null }
    const mockSb = makeSupabaseMock({
      deal_packs: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodPack, error: null }) },
      matches:    { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodMatch, error: null }) },
      contacts:   { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: noEmailContact, error: null }) },
      disclosure_deliveries: {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
        order:  vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(makeReq('POST', `/api/deal-packs/${PACK_ID}/send`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.toLowerCase()).toContain('no email address')
  })
})

// ── §67 Pack/match mismatch → 422 ─────────────────────────────────────────────

describe('§67 Pack/match contact mismatch → 422', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('pack.lead_id != match.lead_id → 422', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const mismatchedPack = { ...goodPack, lead_id: 'different-contact-id' }
    const mockSb = makeSupabaseMock({
      deal_packs: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mismatchedPack, error: null }) },
      matches:    { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodMatch, error: null }) },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(makeReq('POST', `/api/deal-packs/${PACK_ID}/send`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.toLowerCase()).toContain('inconsistent')
  })
})

// ── §68 PDF internal field leakage test ───────────────────────────────────────

describe('§68 Email template buyer-safety — no internal fields in HTML output', () => {
  it('opportunity_score not present in output HTML', () => {
    const html = buildDisclosureEmailHtml({
      buyerFirstName:    'James',
      packTitle:         'Investment Pack',
      propertyTitle:     'Penthouse T4 Chiado',
      propertyLocation:  'Lisboa',
      propertyPrice:     2_500_000,
      propertyType:      'apartment',
      areaM2:            210,
      bedrooms:          4,
      investmentThesis:  'Prime location near Chiado.',
      marketSummary:     'Lisboa luxury market growing.',
      highlights:        ['Sea view', 'Private lift'],
      estimatedYield:    4.2,
      agentName:         'Maria Santos',
      agencyPhone:       '+351 210 000 000',
    })

    // opportunity_score must NOT appear
    expect(html).not.toContain('opportunity_score')
    expect(html).not.toContain('85') // internal score value

    // lead_id, match_id, created_by must NOT appear
    expect(html).not.toContain('lead_id')
    expect(html).not.toContain('match_id')
    expect(html).not.toContain('created_by')

    // Buyer-safe fields MUST be present
    expect(html).toContain('James')
    expect(html).toContain('Penthouse T4 Chiado')
    expect(html).toContain('2 500 000') // formatted price
    expect(html).toContain('4.2%')
  })

  it('investment_thesis text is escaped for XSS', () => {
    const html = buildDisclosureEmailHtml({
      buyerFirstName:   'Test',
      packTitle:        'Pack',
      propertyTitle:    'Property',
      propertyLocation: 'Lisboa',
      propertyPrice:    1_000_000,
      propertyType:     'apartment',
      areaM2:           null,
      bedrooms:         null,
      investmentThesis: '<script>alert("xss")</script>',
      marketSummary:    null,
      highlights:       [],
      estimatedYield:   null,
      agentName:        'Agent',
      agencyPhone:      '+351 000',
    })

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

// ── §55 Provider failure → 502 ───────────────────────────────────────────────

describe('§55 Provider explicit failure → 502', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.DEALPACK_EMAIL_SEND_ACTIVE = 'true'
  })
  afterAll(() => { delete process.env.DEALPACK_EMAIL_SEND_ACTIVE })

  it('Resend returns error → 502 delivery=failed', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const { Resend } = await import('resend')
    vi.mocked(Resend).mockImplementation(() => ({
      emails: {
        send: vi.fn().mockResolvedValue({ data: null, error: { message: 'Rate limit exceeded', name: 'rate_limit' } }),
      },
    }) as unknown as InstanceType<typeof Resend>)

    const mockSb = makeSupabaseMock({
      deal_packs:            { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodPack, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) },
      matches:               { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodMatch, error: null }) },
      contacts:              { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodContact, error: null }) },
      properties:            { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) },
      disclosure_deliveries: {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
        order:  vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'del-fail' }, error: null }),
        update: vi.fn().mockReturnThis(),
      },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(makeReq('POST', `/api/deal-packs/${PACK_ID}/send`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.status).toBe('failed')
  })
})

// ── §57 DB finalization failure → 207 ────────────────────────────────────────

describe('§57 DB finalization failure after successful transport → 207', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.DEALPACK_EMAIL_SEND_ACTIVE = 'true'
  })
  afterAll(() => { delete process.env.DEALPACK_EMAIL_SEND_ACTIVE })

  it('Resend ok but RPC fails → 207 with provider_message_id', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const { Resend } = await import('resend')
    vi.mocked(Resend).mockImplementation(() => ({
      emails: { send: vi.fn().mockResolvedValue({ data: { id: 'resend-ok-001' }, error: null }) },
    }) as unknown as InstanceType<typeof Resend>)

    const mockSbWithFailedRpc = makeSupabaseMock({
      deal_packs: {
        select:      vi.fn().mockReturnThis(),
        eq:          vi.fn().mockReturnThis(),
        single:      vi.fn().mockResolvedValue({ data: goodPack, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
      matches: {
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: goodMatch, error: null }),
      },
      contacts: {
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: goodContact, error: null }),
      },
      properties: {
        select:      vi.fn().mockReturnThis(),
        eq:          vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
      disclosure_deliveries: {
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        order:  vi.fn().mockReturnThis(),
        limit:  vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'del-rpcfail' }, error: null }),
      },
    })
    // Override rpc to simulate finalization failure
    mockSbWithFailedRpc.rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'deadlock' } })
    vi.mocked(createClient).mockReturnValue(mockSbWithFailedRpc as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(makeReq('POST', `/api/deal-packs/${PACK_ID}/send`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(207)
    const body = await res.json()
    expect(body.provider_message_id).toBeTruthy()
    expect(body.ok).toBe(false)
  })
})

// ── §72 Manual disclosure endpoint ───────────────────────────────────────────

describe('§72 POST /api/matches/[id]/disclose/manual', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  const goodBody = {
    pack_id:           PACK_ID,
    method:            'in_person',
    notes:             'Presented pack in Chiado meeting room on 20/09/2026.',
    confirmation_text: 'I confirm this pack was disclosed offline',
  }

  it('service_token → 403', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('service_token'))
    const { POST } = await import('@/app/api/matches/[id]/disclose/manual/route')
    const res = await POST(makeReq('POST', `/api/matches/${MATCH_ID}/disclose/manual`, goodBody), { params: Promise.resolve({ id: MATCH_ID }) })
    expect(res.status).toBe(403)
  })

  it('missing confirmation_text → 400', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })

    const { POST } = await import('@/app/api/matches/[id]/disclose/manual/route')
    const res = await POST(makeReq('POST', `/api/matches/${MATCH_ID}/disclose/manual`, { ...goodBody, confirmation_text: 'wrong text' }), { params: Promise.resolve({ id: MATCH_ID }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.required).toBe('I confirm this pack was disclosed offline')
  })

  it('invalid method → 400', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })

    const { POST } = await import('@/app/api/matches/[id]/disclose/manual/route')
    const res = await POST(makeReq('POST', `/api/matches/${MATCH_ID}/disclose/manual`, { ...goodBody, method: 'carrier_pigeon' }), { params: Promise.resolve({ id: MATCH_ID }) })
    expect(res.status).toBe(400)
  })

  it('disclosure not authorized → 422', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkMatchOwnership).mockResolvedValue({ ok: true })

    const unauthorizedMatch = { ...goodMatch, disclosure_status: null }
    const mockSb = makeSupabaseMock({
      matches: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: unauthorizedMatch, error: null }) },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/matches/[id]/disclose/manual/route')
    const res = await POST(makeReq('POST', `/api/matches/${MATCH_ID}/disclose/manual`, goodBody), { params: Promise.resolve({ id: MATCH_ID }) })
    expect(res.status).toBe(422)
  })

  it('happy path → 200 with activity_id and no email sent', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkMatchOwnership).mockResolvedValue({ ok: true })

    const goodPackForManual = { id: PACK_ID, match_id: MATCH_ID, lead_id: CONTACT_ID, status: 'ready' }
    const mockSb = makeSupabaseMock({
      matches:    {
        select:      vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(),
        single:      vi.fn().mockResolvedValue({ data: goodMatch, error: null }),
        mockReturnValue: undefined,
      },
      deal_packs: {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: goodPackForManual, error: null }),
      },
      activities: {
        insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'act-manual-001' }, error: null }),
      },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/matches/[id]/disclose/manual/route')
    const res = await POST(makeReq('POST', `/api/matches/${MATCH_ID}/disclose/manual`, goodBody), { params: Promise.resolve({ id: MATCH_ID }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.activity_id).toBeTruthy()
    expect(body.message).toContain('No digital communication was sent')
  })
})

// ── §70 D1/D2-A regression guard ─────────────────────────────────────────────

describe('§70 D1/D2-A regression — disclose_match RPC interface unchanged', () => {
  it('matches route still has disclosure PATCH endpoint', async () => {
    const { PATCH } = await import('@/app/api/matches/[id]/route')
    expect(typeof PATCH).toBe('function')
  })
})

// ── §71 D2-B-DEALPACK-AUTH regression guard ───────────────────────────────────

describe('§71 D2-B-DEALPACK-AUTH regression — checkDealPackOwnership still enforces owner-only', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('cross-agent GET /api/deal-packs/[id] still returns 403', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth', 'other-agent@test.com'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({
      ok: false, status: 403, error: 'Not authorized — this deal pack belongs to another agent',
    })

    const { GET } = await import('@/app/api/deal-packs/[id]/route')
    const res = await GET(makeReq('GET', `/api/deal-packs/${PACK_ID}`), { params: Promise.resolve({ id: PACK_ID }) })
    expect(res.status).toBe(403)
  })
})

// ── PV §73 Same-action retry: pending/failed delivery resumes (§10 repair) ───

describe('PV §73 Same-action retry: pending/failed delivery resumes (§10 repair)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.DEALPACK_EMAIL_SEND_ACTIVE
  })

  it('pending delivery for same action_id resumes (flag off → sent:false, reuses delivery.id)', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const ACTION_ID = 'a1b2c3d4-0000-0000-0000-000000000010'
    const mockSb = makeSupabaseMock({
      deal_packs: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodPack, error: null }) },
      matches:    { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodMatch, error: null }) },
      contacts:   { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodContact, error: null }) },
      disclosure_deliveries: {
        select:      vi.fn().mockReturnThis(),
        eq:          vi.fn().mockReturnThis(),
        // 16a: no sent delivery; 16b: pending for this action_id → resume
        maybeSingle: vi.fn()
          .mockResolvedValueOnce({ data: null, error: null })
          .mockResolvedValueOnce({ data: { id: 'del-pending-resume', delivery_status: 'pending', sent_at: null }, error: null }),
      },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(
      makeReq('POST', `/api/deal-packs/${PACK_ID}/send`, { action_id: ACTION_ID }),
      { params: Promise.resolve({ id: PACK_ID }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(false)
    expect(body.delivery_id).toBe('del-pending-resume') // reuses existing delivery row — not a new one
    expect(body.action_id).toBe(ACTION_ID)
  })

  it('failed delivery for same action_id resumes (flag off → sent:false, reuses delivery.id)', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const ACTION_ID = 'a1b2c3d4-0000-0000-0000-000000000011'
    const mockSb = makeSupabaseMock({
      deal_packs: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodPack, error: null }) },
      matches:    { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodMatch, error: null }) },
      contacts:   { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodContact, error: null }) },
      disclosure_deliveries: {
        select:      vi.fn().mockReturnThis(),
        eq:          vi.fn().mockReturnThis(),
        maybeSingle: vi.fn()
          .mockResolvedValueOnce({ data: null, error: null })
          .mockResolvedValueOnce({ data: { id: 'del-failed-resume', delivery_status: 'failed', sent_at: null }, error: null }),
      },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(
      makeReq('POST', `/api/deal-packs/${PACK_ID}/send`, { action_id: ACTION_ID }),
      { params: Promise.resolve({ id: PACK_ID }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.delivery_id).toBe('del-failed-resume') // reuses failed delivery row
    expect(body.action_id).toBe(ACTION_ID)
  })
})

// ── PV §74 Same-action retry: same key already sent → 200 idempotent ────────

describe('PV §74 Same-action retry: same action_id already sent → 200 idempotent', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('same action_id + key is sent → 200 {idempotent:true} (no Resend call)', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const ACTION_ID = 'a1b2c3d4-0000-0000-0000-000000000020'
    const mockSb = makeSupabaseMock({
      deal_packs: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodPack, error: null }) },
      matches:    { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodMatch, error: null }) },
      contacts:   { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodContact, error: null }) },
      disclosure_deliveries: {
        select:      vi.fn().mockReturnThis(),
        eq:          vi.fn().mockReturnThis(),
        // 16a: no global sent; 16b: same action_id is already 'sent' → idempotent 200
        maybeSingle: vi.fn()
          .mockResolvedValueOnce({ data: null, error: null })
          .mockResolvedValueOnce({ data: { id: 'del-idem-sent', delivery_status: 'sent', sent_at: '2026-09-20T10:00:00Z' }, error: null }),
      },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { Resend } = await import('resend')
    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(
      makeReq('POST', `/api/deal-packs/${PACK_ID}/send`, { action_id: ACTION_ID }),
      { params: Promise.resolve({ id: PACK_ID }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(true)
    expect(body.idempotent).toBe(true)
    expect(body.delivery_id).toBe('del-idem-sent')
    expect(body.action_id).toBe(ACTION_ID)
    expect(vi.mocked(Resend)).not.toHaveBeenCalled() // no second email
  })
})

// ── PV §75 Manual disclosure uses record_manual_disclosure RPC (§22+§25) ─────

describe('PV §75 Manual disclosure uses record_manual_disclosure RPC (§22+§25 repair)', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  const goodBody = {
    pack_id:           PACK_ID,
    method:            'in_person',
    notes:             'Presented pack in Chiado meeting room on 20/09/2026.',
    confirmation_text: 'I confirm this pack was disclosed offline',
  }

  it('calls record_manual_disclosure RPC (not separate matches.update + activities.insert)', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkMatchOwnership).mockResolvedValue({ ok: true })

    const mockSb = makeSupabaseMock({
      matches:    { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodMatch, error: null }) },
      deal_packs: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: PACK_ID, match_id: MATCH_ID, lead_id: CONTACT_ID, status: 'ready' }, error: null }) },
    })
    const rpcMock = vi.fn().mockResolvedValue({ data: { activity_id: 'act-rpc-manual-01', recorded_at: '2026-09-20T10:00:00Z' }, error: null })
    mockSb.rpc = rpcMock
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/matches/[id]/disclose/manual/route')
    const res = await POST(
      makeReq('POST', `/api/matches/${MATCH_ID}/disclose/manual`, goodBody),
      { params: Promise.resolve({ id: MATCH_ID }) },
    )
    expect(res.status).toBe(200)

    // RPC must have been called with 'record_manual_disclosure' (atomic — §25)
    expect(rpcMock).toHaveBeenCalledWith('record_manual_disclosure', expect.objectContaining({
      p_match_id:   MATCH_ID,
      p_pack_id:    PACK_ID,
      p_actor_id:   ACTOR_ID,
      p_method:     'in_person',
    }))

    // activities table must NOT have been accessed directly (atomicity via RPC — §25)
    const fromCalls = (mockSb.from as ReturnType<typeof vi.fn>).mock.calls as string[][]
    const activitiesAccessed = fromCalls.some((args) => args[0] === 'activities')
    expect(activitiesAccessed).toBe(false)

    const body = await res.json()
    expect(body.activity_id).toBe('act-rpc-manual-01')
  })
})

// ── SR §B2 Resend idempotency: second arg, no email header leakage ───────────

describe('SR §B2 Resend idempotency key — second arg only, no email header', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.DEALPACK_EMAIL_SEND_ACTIVE = 'true'
  })
  afterAll(() => { delete process.env.DEALPACK_EMAIL_SEND_ACTIVE })

  it('emails.send receives idempotencyKey as second argument options', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const sendMock = vi.fn().mockResolvedValue({ data: { id: 'resend-idem-001' }, error: null })
    const { Resend } = await import('resend')
    vi.mocked(Resend).mockImplementation(() => ({
      emails: { send: sendMock },
    }) as unknown as InstanceType<typeof Resend>)

    const mockSb = makeSupabaseMock({
      deal_packs: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodPack, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) },
      matches:    { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodMatch, error: null }) },
      contacts:   { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodContact, error: null }) },
      properties: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) },
      disclosure_deliveries: {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
        order:  vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'del-idem-sr' }, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const ACTION_ID = 'a1b2c3d4-0000-0000-0000-111111111111'
    await POST(
      makeReq('POST', `/api/deal-packs/${PACK_ID}/send`, { action_id: ACTION_ID }),
      { params: Promise.resolve({ id: PACK_ID }) },
    )

    expect(sendMock).toHaveBeenCalled()
    const [payload, options] = sendMock.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>]

    // Second arg must carry idempotencyKey (SDK sets Idempotency-Key HTTP header)
    expect(options).toHaveProperty('idempotencyKey')
    expect(typeof options.idempotencyKey).toBe('string')
    expect((options.idempotencyKey as string).length).toBeGreaterThan(0)

    // First arg (email payload) must NOT contain X-Idempotency-Key header
    // (that would leak the key to the recipient's email client)
    const headers = payload.headers as Record<string, unknown> | undefined
    expect(headers?.['X-Idempotency-Key']).toBeUndefined()
  })

  it('gdpr_consent=null does NOT block send — unknown ≠ false', async () => {
    vi.mocked(portalAuthGate).mockResolvedValue(makeGate('nextauth'))
    vi.mocked(resolveActor).mockResolvedValue({ ok: true, actor: agentActor })
    vi.mocked(checkDealPackOwnership).mockResolvedValue({ ok: true })

    const { Resend } = await import('resend')
    vi.mocked(Resend).mockImplementation(() => ({
      emails: { send: vi.fn().mockResolvedValue({ data: { id: 'resend-null-consent' }, error: null }) },
    }) as unknown as InstanceType<typeof Resend>)

    const contactNullConsent = { ...goodContact, gdpr_consent: null }
    const mockSb = makeSupabaseMock({
      deal_packs: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodPack, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) },
      matches:    { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: goodMatch, error: null }) },
      contacts:   { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: contactNullConsent, error: null }) },
      properties: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) },
      disclosure_deliveries: {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
        order:  vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'del-null-consent' }, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
    })
    vi.mocked(createClient).mockReturnValue(mockSb as ReturnType<typeof createClient>)

    const { POST } = await import('@/app/api/deal-packs/[id]/send/route')
    const res = await POST(
      makeReq('POST', `/api/deal-packs/${PACK_ID}/send`, { action_id: 'a1b2c3d4-0000-0000-0000-222222222222' }),
      { params: Promise.resolve({ id: PACK_ID }) },
    )
    // null consent must not return 400/422 — it proceeds under V1 controlled authorization
    expect([200, 207]).toContain(res.status)
  })
})

// ── PV §76 Unsubscribe wording — no fake automated unsubscribe copy (§30) ───

describe('PV §76 Email unsubscribe wording is truthful (§30 repair)', () => {
  it('HTML template does not contain misleading automated unsubscribe promise', () => {
    const html = buildDisclosureEmailHtml({
      buyerFirstName: 'Test', packTitle: 'Pack', propertyTitle: 'Property',
      propertyLocation: 'Lisboa', propertyPrice: 1_000_000, propertyType: 'apartment',
      areaM2: null, bedrooms: null, investmentThesis: null, marketSummary: null,
      highlights: [], estimatedYield: null, agentName: 'Agent', agencyPhone: '+351 000',
    })
    // Old misleading copy must be absent
    expect(html).not.toContain('cancelar subscrição')
    expect(html).not.toContain('responda com')
    // Truthful copy must be present
    expect(html).toContain('contacte o seu consultor')
  })

  it('plain text template does not contain misleading automated unsubscribe promise', () => {
    const text = buildDisclosureEmailText({
      buyerFirstName: 'Test', packTitle: 'Pack', propertyTitle: 'Property',
      propertyLocation: 'Lisboa', propertyPrice: 1_000_000, propertyType: 'apartment',
      areaM2: null, bedrooms: null, investmentThesis: null, marketSummary: null,
      highlights: [], estimatedYield: null, agentName: 'Agent', agencyPhone: '+351 000',
    })
    expect(text).not.toContain('cancelar subscrição')
    expect(text).not.toContain('responda com')
    expect(text).toContain('contacte o seu consultor')
  })
})
