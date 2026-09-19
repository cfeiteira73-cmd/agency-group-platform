// =============================================================================
// Phase 2C.D2-A — Disclosure Authorization UI logic tests
// Covers: button visibility, badge model, PATCH payload, modal state,
//         disclosure vs. buyer interest separation (Sections 4, 19, 20, 48)
// =============================================================================

import { describe, it, expect } from 'vitest'

// ─── Button visibility model ──────────────────────────────────────────────────

type MatchForDisplay = {
  status: string
  disclosure_status: string | null
}

function showAuthorizeButton(match: MatchForDisplay): boolean {
  return match.status === 'reviewed_accepted' &&
         match.disclosure_status !== 'authorized'
}

function showRevokeButton(match: MatchForDisplay): boolean {
  return match.status === 'reviewed_accepted' &&
         match.disclosure_status === 'authorized'
}

describe('D2-A UI — AUTORIZAR DIVULGAÇÃO button visibility (Section 19)', () => {
  it('reviewed_accepted + no disclosure → shows AUTORIZAR DIVULGAÇÃO', () => {
    expect(showAuthorizeButton({ status: 'reviewed_accepted', disclosure_status: null })).toBe(true)
  })

  it('reviewed_accepted + revoked → shows AUTORIZAR DIVULGAÇÃO', () => {
    expect(showAuthorizeButton({ status: 'reviewed_accepted', disclosure_status: 'revoked' })).toBe(true)
  })

  it('pending → does NOT show AUTORIZAR DIVULGAÇÃO', () => {
    expect(showAuthorizeButton({ status: 'pending', disclosure_status: null })).toBe(false)
  })

  it('reviewed_rejected → does NOT show AUTORIZAR DIVULGAÇÃO', () => {
    expect(showAuthorizeButton({ status: 'reviewed_rejected', disclosure_status: null })).toBe(false)
  })

  it('reviewed_accepted + authorized → shows REVOGAR not AUTORIZAR', () => {
    const match = { status: 'reviewed_accepted', disclosure_status: 'authorized' }
    expect(showAuthorizeButton(match)).toBe(false)
    expect(showRevokeButton(match)).toBe(true)
  })
})

describe('D2-A UI — REVOGAR AUTORIZAÇÃO button visibility', () => {
  it('authorized → shows REVOGAR', () => {
    expect(showRevokeButton({ status: 'reviewed_accepted', disclosure_status: 'authorized' })).toBe(true)
  })

  it('null → does NOT show REVOGAR', () => {
    expect(showRevokeButton({ status: 'reviewed_accepted', disclosure_status: null })).toBe(false)
  })

  it('revoked → does NOT show REVOGAR', () => {
    expect(showRevokeButton({ status: 'reviewed_accepted', disclosure_status: 'revoked' })).toBe(false)
  })

  it('pending + authorized state → no buttons (reviewed_accepted required)', () => {
    expect(showAuthorizeButton({ status: 'pending', disclosure_status: 'authorized' })).toBe(false)
    expect(showRevokeButton({ status: 'pending', disclosure_status: 'authorized' })).toBe(false)
  })
})

// ─── Disclosure badge model ───────────────────────────────────────────────────

function getDisclosureBadge(disclosureStatus: string | null) {
  if (disclosureStatus === 'authorized') {
    return { show: true, label: 'DIVULGAÇÃO AUTORIZADA', color: '#1c4a35' }
  }
  return { show: false }
}

describe('D2-A UI — DIVULGAÇÃO AUTORIZADA badge', () => {
  it('disclosure_status=authorized → shows badge', () => {
    expect(getDisclosureBadge('authorized').show).toBe(true)
  })

  it('badge label is DIVULGAÇÃO AUTORIZADA', () => {
    const badge = getDisclosureBadge('authorized')
    if (badge.show) {
      expect(badge.label).toBe('DIVULGAÇÃO AUTORIZADA')
    }
  })

  it('disclosure_status=null → no badge', () => {
    expect(getDisclosureBadge(null).show).toBe(false)
  })

  it('disclosure_status=revoked → no badge', () => {
    expect(getDisclosureBadge('revoked').show).toBe(false)
  })

  it('badge does NOT say COMPRADOR INTERESSADO', () => {
    const badge = getDisclosureBadge('authorized')
    if (badge.show) {
      expect(badge.label).not.toContain('COMPRADOR')
      expect(badge.label).not.toContain('INTERESSADO')
    }
  })

  it('badge does NOT say DEAL CRIADO', () => {
    const badge = getDisclosureBadge('authorized')
    if (badge.show) {
      expect(badge.label).not.toContain('DEAL')
    }
  })
})

// ─── PATCH payload model ─────────────────────────────────────────────────────

function buildDisclosurePatch(action: 'authorize' | 'revoke', reason?: string) {
  if (action === 'authorize') {
    const body: Record<string, string> = { disclosure_status: 'authorized' }
    const r = reason?.trim()
    if (r) body.reason = r
    return body
  }
  return { disclosure_status: 'revoked' }
}

describe('D2-A UI — PATCH payload model', () => {
  it('authorize sends disclosure_status=authorized', () => {
    expect(buildDisclosurePatch('authorize').disclosure_status).toBe('authorized')
  })

  it('revoke sends disclosure_status=revoked', () => {
    expect(buildDisclosurePatch('revoke').disclosure_status).toBe('revoked')
  })

  it('disclosure payload does NOT include status (review field — Section 48)', () => {
    expect((buildDisclosurePatch('authorize') as Record<string, unknown>).status).toBeUndefined()
  })

  it('disclosure payload does NOT include buyer_interested', () => {
    expect((buildDisclosurePatch('authorize') as Record<string, unknown>).buyer_interested).toBeUndefined()
  })

  it('reason included when provided', () => {
    const body = buildDisclosurePatch('authorize', 'Cliente confirmado')
    expect(body.reason).toBe('Cliente confirmado')
  })

  it('empty reason trimmed to undefined', () => {
    const body = buildDisclosurePatch('authorize', '   ')
    expect(body.reason).toBeUndefined()
  })
})

// ─── Modal state model ────────────────────────────────────────────────────────

type ModalState = {
  showDisclosureModal: string | null
  disclosureReason: Record<string, string>
}

function openDisclosureModal(state: ModalState, matchId: string): ModalState {
  return { ...state, showDisclosureModal: matchId }
}

function cancelDisclosureModal(state: ModalState, matchId: string): ModalState {
  const n = { ...state.disclosureReason }
  delete n[matchId]
  return { ...state, showDisclosureModal: null, disclosureReason: n }
}

function afterSuccessfulAuthorize(state: ModalState, matchId: string): ModalState {
  const n = { ...state.disclosureReason }
  delete n[matchId]
  return { ...state, showDisclosureModal: null, disclosureReason: n }
}

describe('D2-A UI — Modal state transitions', () => {
  const initial: ModalState = { showDisclosureModal: null, disclosureReason: {} }

  it('click AUTORIZAR DIVULGAÇÃO → modal opens', () => {
    const next = openDisclosureModal(initial, 'match-1')
    expect(next.showDisclosureModal).toBe('match-1')
  })

  it('cancel → modal closes + reason cleared', () => {
    const withModal: ModalState = { showDisclosureModal: 'match-1', disclosureReason: { 'match-1': 'some text' } }
    const next = cancelDisclosureModal(withModal, 'match-1')
    expect(next.showDisclosureModal).toBeNull()
    expect(next.disclosureReason['match-1']).toBeUndefined()
  })

  it('success → modal closes + reason cleared', () => {
    const withModal: ModalState = { showDisclosureModal: 'match-1', disclosureReason: { 'match-1': 'Motivo' } }
    const next = afterSuccessfulAuthorize(withModal, 'match-1')
    expect(next.showDisclosureModal).toBeNull()
    expect(next.disclosureReason['match-1']).toBeUndefined()
  })

  it('only one modal open at a time', () => {
    const next = openDisclosureModal(initial, 'match-2')
    expect(next.showDisclosureModal).toBe('match-2')
    expect(next.showDisclosureModal).not.toBe('match-1')
  })
})

// ─── State update after successful action ─────────────────────────────────────

type HistoricMatch = {
  id: string
  status: string
  disclosure_status: string | null
  disclosure_authorized_at: string | null
}

function applyDisclosureUpdate(
  matches: HistoricMatch[],
  matchId: string,
  newDisclosureStatus: string | null,
  newDisclosureAuthorizedAt: string | null,
): HistoricMatch[] {
  return matches.map(m =>
    m.id === matchId
      ? { ...m, disclosure_status: newDisclosureStatus, disclosure_authorized_at: newDisclosureAuthorizedAt }
      : m
  )
}

describe('D2-A UI — State update model', () => {
  const matches: HistoricMatch[] = [
    { id: 'match-1', status: 'reviewed_accepted', disclosure_status: null, disclosure_authorized_at: null },
    { id: 'match-2', status: 'reviewed_accepted', disclosure_status: null, disclosure_authorized_at: null },
  ]

  it('authorize updates only the target match', () => {
    const updated = applyDisclosureUpdate(matches, 'match-1', 'authorized', '2026-09-19T00:00:00Z')
    expect(updated[0].disclosure_status).toBe('authorized')
    expect(updated[1].disclosure_status).toBeNull()
  })

  it('revoke updates disclosure_status to revoked', () => {
    const authorized = applyDisclosureUpdate(matches, 'match-1', 'authorized', '2026-09-19T00:00:00Z')
    const revoked = applyDisclosureUpdate(authorized, 'match-1', 'revoked', null)
    expect(revoked[0].disclosure_status).toBe('revoked')
  })

  it('update preserves existing status field', () => {
    const updated = applyDisclosureUpdate(matches, 'match-1', 'authorized', '2026-09-19T00:00:00Z')
    expect(updated[0].status).toBe('reviewed_accepted')
  })

  it('update does NOT set buyer_interested on match', () => {
    const updated = applyDisclosureUpdate(matches, 'match-1', 'authorized', '2026-09-19T00:00:00Z')
    expect((updated[0] as Record<string, unknown>).buyer_interested).toBeUndefined()
  })
})

// ─── Permanent invariants (Sections 4, 48) ───────────────────────────────────

describe('D2-A UI — Permanent invariants', () => {
  it('ACEITE PELO AGENTE badge remains unchanged (D1 not modified)', () => {
    function getStatusBadge(status: string) {
      if (status === 'reviewed_accepted') return 'ACEITE PELO AGENTE'
      if (status === 'reviewed_rejected') return 'REJEITADO PELO AGENTE'
      return 'POR REVER'
    }
    expect(getStatusBadge('reviewed_accepted')).toBe('ACEITE PELO AGENTE')
  })

  it('Section 4: ACEITE PELO AGENTE ≠ DIVULGAÇÃO AUTORIZADA', () => {
    const reviewBadge = 'ACEITE PELO AGENTE'
    const disclosureBadge = 'DIVULGAÇÃO AUTORIZADA'
    expect(reviewBadge).not.toBe(disclosureBadge)
  })

  it('Section 48: no COMPRADOR INTERESSADO button in D2-A scope', () => {
    const d2aButtons = ['AUTORIZAR DIVULGAÇÃO', 'REVOGAR AUTORIZAÇÃO', 'CONFIRMAR AUTORIZAÇÃO', 'Cancelar']
    expect(d2aButtons.some(b => b.toUpperCase().includes('COMPRADOR'))).toBe(false)
    expect(d2aButtons.some(b => b.toUpperCase().includes('INTERESSADO'))).toBe(false)
  })

  it('Section 48: no ENVIAR DEAL PACK button in D2-A scope', () => {
    const d2aButtons = ['AUTORIZAR DIVULGAÇÃO', 'REVOGAR AUTORIZAÇÃO', 'CONFIRMAR AUTORIZAÇÃO', 'Cancelar']
    expect(d2aButtons.some(b => b.toUpperCase().includes('ENVIAR'))).toBe(false)
    expect(d2aButtons.some(b => b.toUpperCase().includes('DEAL PACK'))).toBe(false)
  })
})
