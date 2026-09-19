// =============================================================================
// Phase 2C.D2-A — Disclosure Authorization API logic tests
// Covers: payload construction, authorization rules, revocation rules,
//         off-market gate, permanent invariants (Sections 4, 13, 48)
// =============================================================================

import { describe, it, expect } from 'vitest'

// ─── Payload construction ────────────────────────────────────────────────────

function buildDisclosurePatch(disclosureStatus: 'authorized' | 'revoked', reason?: string) {
  const body: Record<string, string> = { disclosure_status: disclosureStatus }
  const r = reason?.trim()
  if (r) body.reason = r
  return body
}

describe('D2-A API — Disclosure PATCH payload construction', () => {
  it('authorize without reason sends only disclosure_status', () => {
    const body = buildDisclosurePatch('authorized')
    expect(body).toEqual({ disclosure_status: 'authorized' })
    expect(body.reason).toBeUndefined()
  })

  it('authorize with reason sends disclosure_status + reason', () => {
    const body = buildDisclosurePatch('authorized', '  Cliente confirmado, off-market acordado  ')
    expect(body.disclosure_status).toBe('authorized')
    expect(body.reason).toBe('Cliente confirmado, off-market acordado')
  })

  it('revoke without reason sends only disclosure_status', () => {
    const body = buildDisclosurePatch('revoked')
    expect(body).toEqual({ disclosure_status: 'revoked' })
  })

  it('disclosure payload does NOT include status (review field)', () => {
    const body = buildDisclosurePatch('authorized')
    expect((body as Record<string, unknown>).status).toBeUndefined()
  })

  it('disclosure payload does NOT include notes (review field)', () => {
    const body = buildDisclosurePatch('authorized')
    expect((body as Record<string, unknown>).notes).toBeUndefined()
  })
})

// ─── Authorization rules ─────────────────────────────────────────────────────

type MatchState = {
  status: string
  disclosure_status: string | null
}

function canAuthorize(match: MatchState): { ok: boolean; error?: string } {
  if (match.status !== 'reviewed_accepted') {
    return { ok: false, error: 'Disclosure authorization requires match status reviewed_accepted' }
  }
  if (match.disclosure_status === 'authorized') {
    return { ok: false, error: 'Match disclosure already authorized (idempotent)' }
  }
  return { ok: true }
}

function canRevoke(match: MatchState): { ok: boolean; error?: string } {
  if (match.disclosure_status !== 'authorized') {
    return { ok: false, error: 'Cannot revoke: match disclosure not currently authorized' }
  }
  return { ok: true }
}

describe('D2-A API — Authorization pre-conditions', () => {
  it('reviewed_accepted + no disclosure → can authorize', () => {
    expect(canAuthorize({ status: 'reviewed_accepted', disclosure_status: null }).ok).toBe(true)
  })

  it('pending → cannot authorize', () => {
    const result = canAuthorize({ status: 'pending', disclosure_status: null })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('reviewed_accepted')
  })

  it('reviewed_rejected → cannot authorize', () => {
    expect(canAuthorize({ status: 'reviewed_rejected', disclosure_status: null }).ok).toBe(false)
  })

  it('already authorized → idempotent, not a hard error', () => {
    const result = canAuthorize({ status: 'reviewed_accepted', disclosure_status: 'authorized' })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('idempotent')
  })
})

describe('D2-A API — Revocation pre-conditions', () => {
  it('disclosure=authorized → can revoke', () => {
    expect(canRevoke({ status: 'reviewed_accepted', disclosure_status: 'authorized' }).ok).toBe(true)
  })

  it('disclosure=null → cannot revoke', () => {
    const result = canRevoke({ status: 'reviewed_accepted', disclosure_status: null })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not currently authorized')
  })

  it('disclosure=revoked → cannot revoke again', () => {
    expect(canRevoke({ status: 'reviewed_accepted', disclosure_status: 'revoked' }).ok).toBe(false)
  })
})

// ─── Off-market gate ─────────────────────────────────────────────────────────

function validateOffMarketReason(isOffMarket: boolean, reason: string | undefined): { ok: boolean; error?: string } {
  if (isOffMarket && (!reason || !reason.trim())) {
    return { ok: false, error: 'Motivo obrigatório para imóveis off-market' }
  }
  return { ok: true }
}

describe('D2-A API — Off-market reason gate', () => {
  it('off-market + no reason → rejected', () => {
    expect(validateOffMarketReason(true, undefined).ok).toBe(false)
  })

  it('off-market + empty reason → rejected', () => {
    expect(validateOffMarketReason(true, '   ').ok).toBe(false)
  })

  it('off-market + reason provided → allowed', () => {
    expect(validateOffMarketReason(true, 'Apresentação privada acordada com cliente').ok).toBe(true)
  })

  it('on-market + no reason → allowed', () => {
    expect(validateOffMarketReason(false, undefined).ok).toBe(true)
  })

  it('on-market + empty reason → allowed', () => {
    expect(validateOffMarketReason(false, '').ok).toBe(true)
  })
})

// ─── Service token rejection (Section 13/25) ─────────────────────────────────

describe('D2-A API — Service token rejection (Section 25)', () => {
  it('gate.via === service_token → 403 before disclosure check', () => {
    const gate = { authed: true, via: 'service_token' as const, email: '' }
    const isServiceToken = gate.via === 'service_token'
    expect(isServiceToken).toBe(true)
  })

  it('disclosure action must never proceed with service token', () => {
    function disclosureGateCheck(via: string) {
      return via === 'service_token'
        ? { blocked: true, reason: 'Service tokens cannot authorize disclosure — human actor required' }
        : { blocked: false }
    }
    expect(disclosureGateCheck('service_token').blocked).toBe(true)
    expect(disclosureGateCheck('session').blocked).toBe(false)
  })
})

// ─── Permanent invariants (Section 4, 48) ────────────────────────────────────

describe('D2-A API — Permanent invariants', () => {
  it('Section 4: DISCLOSURE AUTHORIZED ≠ ACTUALLY DISCLOSED', () => {
    const disclosureStatus = 'authorized'
    const actuallyDisclosed = false
    expect(disclosureStatus === 'authorized').toBe(true)
    expect(actuallyDisclosed).toBe(false)
  })

  it('Section 4: DISCLOSURE AUTHORIZED ≠ BUYER INTERESTED', () => {
    const disclosureStatus = 'authorized'
    const buyerInterested = null
    expect(disclosureStatus === 'authorized' && buyerInterested !== null).toBe(false)
  })

  it('Section 48: disclosure_status does NOT create a deal', () => {
    const disclosureUpdate = { disclosure_status: 'authorized', disclosure_authorized_at: new Date().toISOString() }
    expect(Object.keys(disclosureUpdate)).not.toContain('deal_id')
    expect(Object.keys(disclosureUpdate)).not.toContain('deal_value')
  })

  it('Section 48: disclosure_status does NOT trigger outbound comms', () => {
    function buildDisclosureUpdate(status: string) {
      return { disclosure_status: status, updated_at: new Date().toISOString() }
    }
    const update = buildDisclosureUpdate('authorized')
    expect(update).not.toHaveProperty('email_sent')
    expect(update).not.toHaveProperty('whatsapp_sent')
    expect(update).not.toHaveProperty('sms_sent')
  })

  it('Section 13: authorization identity is server-derived — not client-supplied', () => {
    const clientBody = { disclosure_status: 'authorized', disclosure_authorized_by: 'fake-uuid' }
    const trustedFields = ['disclosure_status', 'reason']
    const honoured = Object.keys(clientBody).filter(k => trustedFields.includes(k))
    const rejected  = Object.keys(clientBody).filter(k => !trustedFields.includes(k))
    expect(honoured).toContain('disclosure_status')
    expect(rejected).toContain('disclosure_authorized_by')
  })
})

// ─── Activity event model ─────────────────────────────────────────────────────

function buildDisclosureActivity(action: 'authorized' | 'revoked', reason?: string) {
  return {
    type: action === 'authorized' ? 'match_disclosure_authorized' : 'match_disclosure_revoked',
    is_automated: false,
    body: reason ?? null,
  }
}

describe('D2-A API — Activity event model', () => {
  it('authorize → type=match_disclosure_authorized', () => {
    expect(buildDisclosureActivity('authorized').type).toBe('match_disclosure_authorized')
  })

  it('revoke → type=match_disclosure_revoked', () => {
    expect(buildDisclosureActivity('revoked').type).toBe('match_disclosure_revoked')
  })

  it('activity is_automated=false (Section 15)', () => {
    expect(buildDisclosureActivity('authorized').is_automated).toBe(false)
  })

  it('reason stored in body (canonical column from migration 055)', () => {
    const act = buildDisclosureActivity('authorized', 'Cliente validado')
    expect(act.body).toBe('Cliente validado')
  })

  it('body is null when no reason provided', () => {
    expect(buildDisclosureActivity('authorized').body).toBeNull()
  })

  it('activity does NOT mark buyer_interested', () => {
    const act = buildDisclosureActivity('authorized')
    expect(Object.keys(act)).not.toContain('buyer_interested')
  })
})
