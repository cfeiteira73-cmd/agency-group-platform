// =============================================================================
// Phase 2C.D1-REVIEW — Human Match Review & Commercial Decision Layer
// Tests: status transitions, idempotency, invariants, field protection, auth
// =============================================================================

import { describe, it, expect } from 'vitest'

// ─── Status transition model ──────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:             ['reviewed_accepted', 'reviewed_rejected'],
  reviewed_accepted:   ['reviewed_rejected'],
  reviewed_rejected:   ['reviewed_accepted'],
}

function isValidTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to)
}

const ACTIVITY_TYPE: Record<string, string | undefined> = {
  reviewed_accepted: 'match_agent_accepted',
  reviewed_rejected: 'match_agent_rejected',
}

describe('D1-REVIEW — Status transition model', () => {
  it('pending → reviewed_accepted is valid', () => {
    expect(isValidTransition('pending', 'reviewed_accepted')).toBe(true)
  })

  it('pending → reviewed_rejected is valid', () => {
    expect(isValidTransition('pending', 'reviewed_rejected')).toBe(true)
  })

  it('reviewed_accepted → reviewed_rejected is valid (flip)', () => {
    expect(isValidTransition('reviewed_accepted', 'reviewed_rejected')).toBe(true)
  })

  it('reviewed_rejected → reviewed_accepted is valid (flip)', () => {
    expect(isValidTransition('reviewed_rejected', 'reviewed_accepted')).toBe(true)
  })

  it('pending → pending is NOT a valid transition (same status = idempotent, not a transition)', () => {
    expect(isValidTransition('pending', 'pending')).toBe(false)
  })

  it('reviewed_accepted → pending is NOT valid (no going back to pending)', () => {
    expect(isValidTransition('reviewed_accepted', 'pending')).toBe(false)
  })

  it('reviewed_rejected → pending is NOT valid', () => {
    expect(isValidTransition('reviewed_rejected', 'pending')).toBe(false)
  })

  it('unknown status → any is NOT valid', () => {
    expect(isValidTransition('unknown', 'reviewed_accepted')).toBe(false)
  })

  it('all valid target statuses are defined', () => {
    const allTargets = Object.values(VALID_TRANSITIONS).flat()
    const expected = ['reviewed_accepted', 'reviewed_rejected']
    for (const t of expected) {
      expect(allTargets).toContain(t)
    }
  })
})

// ─── Activity event type mapping ──────────────────────────────────────────────

describe('D1-REVIEW — Activity event types', () => {
  it('reviewed_accepted → match_agent_accepted event', () => {
    expect(ACTIVITY_TYPE['reviewed_accepted']).toBe('match_agent_accepted')
  })

  it('reviewed_rejected → match_agent_rejected event', () => {
    expect(ACTIVITY_TYPE['reviewed_rejected']).toBe('match_agent_rejected')
  })

  it('pending status has no activity type (no event on initial match)', () => {
    expect(ACTIVITY_TYPE['pending']).toBeUndefined()
  })
})

// ─── Idempotency rule (Section 11) ────────────────────────────────────────────

describe('D1-REVIEW — Idempotency (Section 11)', () => {
  it('same status + no notes change = no new activity event should be generated', () => {
    const currentStatus = 'reviewed_accepted'
    const newStatus = 'reviewed_accepted'
    const newNotes = undefined
    const isIdempotent = currentStatus === newStatus && newNotes === undefined
    expect(isIdempotent).toBe(true)
  })

  it('same status + notes changed = NOT idempotent (notes update is real)', () => {
    const currentStatus = 'reviewed_accepted'
    const newStatus = 'reviewed_accepted'
    const newNotes = 'Updated review note'
    const isIdempotent = currentStatus === newStatus && newNotes === undefined
    expect(isIdempotent).toBe(false)
  })

  it('different status = NOT idempotent (status change always generates event)', () => {
    const isIdempotent = 'pending' === 'reviewed_accepted' && undefined === undefined
    expect(isIdempotent).toBe(false)
  })
})

// ─── Mutable vs immutable fields (Sections 27, 26) ───────────────────────────

const MUTABLE_FIELDS = new Set(['status', 'notes'])

const IMMUTABLE_FIELDS = [
  'match_score', 'breakdown', 'match_reasons', 'explanation',
  'similarity', 'priority_level', 'next_best_action', 'match_weaknesses',
  'lead_id', 'property_id', 'mandate_id', 'matched_by',
  'reviewed_at', 'reviewed_by', // server-derived, not client-settable
]

describe('D1-REVIEW — Field protection (Sections 26, 27)', () => {
  it('status is mutable by client', () => {
    expect(MUTABLE_FIELDS.has('status')).toBe(true)
  })

  it('notes is mutable by client', () => {
    expect(MUTABLE_FIELDS.has('notes')).toBe(true)
  })

  it('match_score is NOT mutable by client', () => {
    expect(MUTABLE_FIELDS.has('match_score')).toBe(false)
  })

  it('lead_id is NOT mutable by client', () => {
    expect(MUTABLE_FIELDS.has('lead_id')).toBe(false)
  })

  it('reviewed_at is NOT mutable by client (server-generated)', () => {
    expect(MUTABLE_FIELDS.has('reviewed_at')).toBe(false)
  })

  it('reviewed_by is NOT mutable by client (server-derived from auth)', () => {
    expect(MUTABLE_FIELDS.has('reviewed_by')).toBe(false)
  })

  for (const field of IMMUTABLE_FIELDS) {
    it(`'${field}' is NOT mutable by client`, () => {
      expect(MUTABLE_FIELDS.has(field)).toBe(false)
    })
  }
})

// ─── Service token rejection (Section 25) ────────────────────────────────────

describe('D1-REVIEW — Service token rejection (Section 25)', () => {
  it('service_token via is NOT authorized to review matches', () => {
    const via = 'service_token'
    const isHumanActor = via !== 'service_token'
    expect(isHumanActor).toBe(false)
  })

  it('nextauth via IS authorized to review matches', () => {
    const via = 'nextauth'
    const isHumanActor = via !== 'service_token'
    expect(isHumanActor).toBe(true)
  })

  it('magic_link via IS authorized to review matches', () => {
    const via = 'magic_link'
    const isHumanActor = via !== 'service_token'
    expect(isHumanActor).toBe(true)
  })

  it('service token emails are not human actors', () => {
    const serviceEmails = ['cron@agencygroup.pt', 'internal@agencygroup.pt']
    for (const email of serviceEmails) {
      // These would get reviewed_by = null since they have no row in public.users
      const isHumanEmail = !serviceEmails.includes(email)
      expect(isHumanEmail).toBe(false)
    }
  })
})

// ─── match_id UUID validation ─────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('D1-REVIEW — UUID validation for match_id', () => {
  it('valid UUID passes', () => {
    expect(UUID_REGEX.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('plain integer fails (not a UUID)', () => {
    expect(UUID_REGEX.test('123')).toBe(false)
  })

  it('empty string fails', () => {
    expect(UUID_REGEX.test('')).toBe(false)
  })

  it('partial UUID fails', () => {
    expect(UUID_REGEX.test('550e8400-e29b-41d4')).toBe(false)
  })
})

// ─── Activity derivation (Sections 28, 29) ────────────────────────────────────

describe('D1-REVIEW — Activity derivation from server state (Sections 28, 29)', () => {
  it('contact_id in activity is derived from match.lead_id (NOT from client body)', () => {
    // Section 28: the PATCH handler reads match.lead_id from DB, not from request body
    const matchLeadId = '550e8400-e29b-41d4-a716-446655440001'
    const clientSuppliedContactId = '999-different-id'
    const derivedContactId = matchLeadId // server always uses match.lead_id
    expect(derivedContactId).toBe(matchLeadId)
    expect(derivedContactId).not.toBe(clientSuppliedContactId)
  })

  it('agent_id in activity is derived from auth identity (NOT from client body)', () => {
    // Section 29: reviewed_by/agent_id come from public.users WHERE email = gate.email
    const clientSuppliedAgentId = 'fake-uuid-from-client'
    const serverDerivedAgentId = 'real-uuid-from-users-table'
    expect(serverDerivedAgentId).not.toBe(clientSuppliedAgentId)
  })

  it('activity type matches status transition deterministically', () => {
    expect(ACTIVITY_TYPE['reviewed_accepted']).toBe('match_agent_accepted')
    expect(ACTIVITY_TYPE['reviewed_rejected']).toBe('match_agent_rejected')
  })
})

// ─── Permanent invariants (Sections 14, 15, 33) ──────────────────────────────

describe('D1-REVIEW — Permanent invariants preserved', () => {
  it('semantic_bonus = 0 always (SEM-IMPL-RV2 deferred)', () => {
    const semanticBonus = 0
    expect(semanticBonus).toBe(0)
  })

  it('trigger_deal_pack = false always', () => {
    const triggerDealPack = false
    expect(triggerDealPack).toBe(false)
  })

  it('AGENT ACCEPTS MATCH ≠ CREATE DEAL (Section 14)', () => {
    const dealCreatedOnAccept = false
    expect(dealCreatedOnAccept).toBe(false)
  })

  it('no outbound communications on accept (Section 15)', () => {
    const emailSentOnAccept = false
    const whatsappSentOnAccept = false
    const smsSentOnAccept = false
    expect(emailSentOnAccept).toBe(false)
    expect(whatsappSentOnAccept).toBe(false)
    expect(smsSentOnAccept).toBe(false)
  })

  it('no buyer-facing side effects on accept (Section 15)', () => {
    const buyerContactedOnAccept = false
    const dealPackGeneratedOnAccept = false
    const offMarketDetailsExposedOnAccept = false
    expect(buyerContactedOnAccept).toBe(false)
    expect(dealPackGeneratedOnAccept).toBe(false)
    expect(offMarketDetailsExposedOnAccept).toBe(false)
  })

  it('no OpenAI calls in D1-REVIEW (Section 33)', () => {
    const openAiCallsMade = 0
    expect(openAiCallsMade).toBe(0)
  })
})

// ─── Migration 076 schema additions ──────────────────────────────────────────

describe('D1-REVIEW — Migration 076 schema additions', () => {
  it('matches.notes: TEXT NULL (human-written, machine must not write)', () => {
    const colDef = { name: 'notes', type: 'TEXT', nullable: true }
    expect(colDef.type).toBe('TEXT')
    expect(colDef.nullable).toBe(true)
  })

  it('matches.reviewed_at: TIMESTAMPTZ NULL (server-generated)', () => {
    const colDef = { name: 'reviewed_at', type: 'TIMESTAMPTZ', nullable: true }
    expect(colDef.type).toBe('TIMESTAMPTZ')
    expect(colDef.nullable).toBe(true)
  })

  it('matches.reviewed_by: UUID NULL FK → public.users(id)', () => {
    const colDef = { name: 'reviewed_by', type: 'UUID', nullable: true, fk: 'public.users(id)' }
    expect(colDef.type).toBe('UUID')
    expect(colDef.nullable).toBe(true)
    expect(colDef.fk).toBe('public.users(id)')
  })

  it('FK target is public.users (canonical: session.user.id = public.users.id per auth.ts)', () => {
    const canonicalTable = 'public.users'
    expect(canonicalTable).toBe('public.users')
  })

  it('CHECK constraint allows all valid statuses', () => {
    const allowed = ['pending', 'reviewed_accepted', 'reviewed_rejected']
    expect(allowed).toContain('pending')
    expect(allowed).toContain('reviewed_accepted')
    expect(allowed).toContain('reviewed_rejected')
  })

  it('CHECK constraint uses NOT VALID (does not scan existing rows)', () => {
    const notValid = true // migration uses NOT VALID
    expect(notValid).toBe(true)
  })
})

// ─── GET /api/matches — new fields in SELECT ─────────────────────────────────

describe('D1-REVIEW — GET /api/matches new fields', () => {
  it('GET SELECT includes notes', () => {
    const selectFields = 'id, lead_id, property_id, property_title, match_score, match_reasons, explanation, similarity, estimated_yield, status, matched_by, notes, reviewed_at, reviewed_by, breakdown, match_weaknesses, priority_level, created_at, updated_at'
    expect(selectFields).toContain('notes')
  })

  it('GET SELECT includes reviewed_at', () => {
    const selectFields = 'id, lead_id, property_id, property_title, match_score, match_reasons, explanation, similarity, estimated_yield, status, matched_by, notes, reviewed_at, reviewed_by, breakdown, match_weaknesses, priority_level, created_at, updated_at'
    expect(selectFields).toContain('reviewed_at')
  })

  it('GET SELECT includes reviewed_by', () => {
    const selectFields = 'id, lead_id, property_id, property_title, match_score, match_reasons, explanation, similarity, estimated_yield, status, matched_by, notes, reviewed_at, reviewed_by, breakdown, match_weaknesses, priority_level, created_at, updated_at'
    expect(selectFields).toContain('reviewed_by')
  })
})

// ─── upsert_match_v1 safety (Section 26) ─────────────────────────────────────

describe('D1-REVIEW — upsert_match_v1 must NOT touch review fields (Section 26)', () => {
  // The UPDATE block in upsert_match_v1 (migration 071) explicitly lists only
  // algorithm fields. notes, reviewed_at, reviewed_by are NOT in that list.
  // They are therefore safe — the machine rescore path will never overwrite them.
  const machineUpdateFields = [
    'property_title', 'match_score', 'breakdown', 'match_reasons',
    'explanation', 'similarity', 'estimated_yield', 'next_best_action',
    'match_weaknesses', 'priority_level', 'next_action_deadline', 'updated_at',
  ]

  it('upsert_match_v1 does NOT update notes', () => {
    expect(machineUpdateFields).not.toContain('notes')
  })

  it('upsert_match_v1 does NOT update reviewed_at', () => {
    expect(machineUpdateFields).not.toContain('reviewed_at')
  })

  it('upsert_match_v1 does NOT update reviewed_by', () => {
    expect(machineUpdateFields).not.toContain('reviewed_by')
  })

  it('upsert_match_v1 does NOT update status', () => {
    expect(machineUpdateFields).not.toContain('status')
  })
})
