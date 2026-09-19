// =============================================================================
// Phase 2C.D2-B-AUTH-REPAIR — commercialAuth unit tests
// Tests: resolveActor + checkMatchOwnership
// Pattern: pure logic with mocked supabase — no DB, no network
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveActor, checkMatchOwnership } from '@/lib/auth/commercialAuth'
import type { SupabaseClient } from '@supabase/supabase-js'

// Minimal supabase mock builder — returns what .single() resolves to
function makeSupabase(
  usersRow: Record<string, unknown> | null,
  contactRow: Record<string, unknown> | null = null,
): SupabaseClient {
  const usersSingle = vi.fn().mockResolvedValue({ data: usersRow, error: usersRow ? null : { message: 'not found' } })
  const usersSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ single: usersSingle }),
  })

  const contactsSingle = vi.fn().mockResolvedValue({ data: contactRow, error: contactRow ? null : { message: 'not found' } })
  const contactsSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ single: contactsSingle }),
  })

  return {
    from: vi.fn((table: string) => {
      if (table === 'users') return { select: usersSelect }
      if (table === 'contacts') return { select: contactsSelect }
      return {}
    }),
  } as unknown as SupabaseClient
}

// ============================================================
// resolveActor
// ============================================================

describe('resolveActor', () => {
  it('§35 empty email → 401', async () => {
    const sb = makeSupabase(null)
    const result = await resolveActor('', sb)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
    }
  })

  it('§35 whitespace-only email → 401', async () => {
    const sb = makeSupabase(null)
    const result = await resolveActor('   ', sb)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
    }
  })

  it('§37 user not found in public.users → 403', async () => {
    const sb = makeSupabase(null)
    const result = await resolveActor('ghost@agent.com', sb)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
      expect(result.error).toContain('public.users')
    }
  })

  it('§35 inactive user (is_active=false) → 403', async () => {
    const sb = makeSupabase({ id: 'u1', role: 'agent', is_active: false })
    const result = await resolveActor('inactive@agent.com', sb)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
      expect(result.error).toContain('inactive')
    }
  })

  it('§31 active user (is_active=true) → ok with normalized email', async () => {
    const sb = makeSupabase({ id: 'u2', role: 'agent', is_active: true })
    const result = await resolveActor('  Agent@Agency.COM  ', sb)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.actor.email).toBe('agent@agency.com')
      expect(result.actor.id).toBe('u2')
      expect(result.actor.role).toBe('agent')
      expect(result.actor.isAdmin).toBe(false)
    }
  })

  it('active user (is_active=null) treated as active → ok', async () => {
    const sb = makeSupabase({ id: 'u3', role: 'agent', is_active: null })
    const result = await resolveActor('legacy@agent.com', sb)
    expect(result.ok).toBe(true)
  })

  it('§33 admin user → isAdmin=true', async () => {
    const sb = makeSupabase({ id: 'u4', role: 'admin', is_active: true })
    const result = await resolveActor('admin@agency.com', sb)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.actor.isAdmin).toBe(true)
      expect(result.actor.role).toBe('admin')
    }
  })

  it('role=null defaults to agent', async () => {
    const sb = makeSupabase({ id: 'u5', role: null, is_active: true })
    const result = await resolveActor('norole@agent.com', sb)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.actor.role).toBe('agent')
      expect(result.actor.isAdmin).toBe(false)
    }
  })

  it('§36 service_token synthetic email → not found in public.users → 403', async () => {
    // Service tokens (cron@, internal@) never resolve to a public.users row
    const sb = makeSupabase(null)
    const result = await resolveActor('cron@internal', sb)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
    }
  })
})

// ============================================================
// checkMatchOwnership
// ============================================================

const adminActor = { id: 'admin-id', email: 'admin@agency.com', role: 'admin', isAdmin: true }
const agentActor = { id: 'agent-id', email: 'alice@agency.com', role: 'agent', isAdmin: false }
const otherActor = { id: 'other-id', email: 'bob@agency.com', role: 'agent', isAdmin: false }

describe('checkMatchOwnership', () => {
  it('§38 empty leadId → 403', async () => {
    const sb = makeSupabase(null, null)
    const result = await checkMatchOwnership(agentActor, '', sb)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
    }
  })

  it('§38 contact not found → 403 (fails closed)', async () => {
    const sb = makeSupabase(null, null)
    const result = await checkMatchOwnership(agentActor, 'lead-uuid', sb)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
      expect(result.error).toContain('Contact not found')
    }
  })

  it('§34 unassigned contact (agent_email=null) + non-admin → 403', async () => {
    const sb = makeSupabase(null, { agent_email: null })
    const result = await checkMatchOwnership(agentActor, 'lead-uuid', sb)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
      expect(result.error).toContain('unassigned')
    }
  })

  it('§34 unassigned contact (agent_email=null) + admin → ok', async () => {
    const sb = makeSupabase(null, { agent_email: null })
    const result = await checkMatchOwnership(adminActor, 'lead-uuid', sb)
    expect(result.ok).toBe(true)
  })

  it('§31 owner acts on own contact → ok', async () => {
    const sb = makeSupabase(null, { agent_email: 'alice@agency.com' })
    const result = await checkMatchOwnership(agentActor, 'lead-uuid', sb)
    expect(result.ok).toBe(true)
  })

  it('§39 case-insensitive ownership match → ok', async () => {
    const sb = makeSupabase(null, { agent_email: '  Alice@Agency.COM  ' })
    const result = await checkMatchOwnership(agentActor, 'lead-uuid', sb)
    expect(result.ok).toBe(true)
  })

  it('§32 cross-agent: agent acting on another agent\'s contact → 403', async () => {
    const sb = makeSupabase(null, { agent_email: 'alice@agency.com' })
    const result = await checkMatchOwnership(otherActor, 'lead-uuid', sb)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
      expect(result.error).toContain('another agent')
    }
  })

  it('§33 admin acts on another agent\'s contact → ok', async () => {
    const sb = makeSupabase(null, { agent_email: 'alice@agency.com' })
    const result = await checkMatchOwnership(adminActor, 'lead-uuid', sb)
    expect(result.ok).toBe(true)
  })
})
