// =============================================================================
// Agency Group — Commercial Actor Authorization
// Phase 2C.D2-B-AUTH-REPAIR
//
// Enforces the minimum human authorization boundary for sensitive commercial
// mutations: match review (D1), disclosure authorization/revocation (D2-A).
//
// Model B:
//   Assigned contact (contacts.agent_email IS NOT NULL):
//     contact owner OR admin may act
//   Unassigned contact (contacts.agent_email IS NULL):
//     admin only — no fallback to any-agent
//
// is_active canonical semantics (consistent with auth.ts + getSession.ts):
//   is_active = null  → active (NULL treated as active for historical rows)
//   is_active = false → denied
//   is_active = true  → active
//
// This helper performs a fresh DB read for is_active on every commercial call,
// because NextAuth sessions cache identity in the JWT without re-checking
// deactivation per-request (magic_link already re-checks via getAnySession).
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'

export interface CommercialActor {
  /** public.users.id — server-resolved, never client-supplied */
  id: string
  /** Normalized email: trimmed + lowercase. Use for ownership comparison. */
  email: string
  role: string
  isAdmin: boolean
}

export type CommercialActorResult =
  | { ok: true; actor: CommercialActor }
  | { ok: false; status: 401 | 403; error: string }

export type OwnershipResult =
  | { ok: true }
  | { ok: false; status: 403; error: string }

/**
 * Resolves a human actor from an authenticated email against public.users.
 *
 * Performs a fresh DB read to enforce is_active — this closes the gap where
 * a deactivated user's NextAuth JWT remains valid until it naturally expires.
 *
 * Must be called AFTER the auth gate (portalAuthGate) has already confirmed
 * a valid human session and explicitly rejected service tokens.
 */
export async function resolveActor(
  rawEmail: string,
  supabase: SupabaseClient,
): Promise<CommercialActorResult> {
  const email = rawEmail.trim().toLowerCase()
  if (!email) {
    return { ok: false, status: 401, error: 'No authenticated identity' }
  }

  const { data: user } = await supabase
    .from('users')
    .select('id, role, is_active')
    .eq('email', rawEmail.trim())
    .single()

  if (!user) {
    return {
      ok: false,
      status: 403,
      error: 'Authenticated user not found in public.users — human actor required',
    }
  }

  if (user.is_active === false) {
    return {
      ok: false,
      status: 403,
      error: 'Agent account inactive — commercial mutations require an active account',
    }
  }

  return {
    ok: true,
    actor: {
      id: user.id,
      email,
      role: user.role ?? 'agent',
      isAdmin: user.role === 'admin',
    },
  }
}

/**
 * Checks whether an actor is authorized to perform a commercial mutation on
 * the contact linked to a match (identified by leadId = match.lead_id).
 *
 * Fails closed when the contact cannot be resolved — ownership cannot be
 * inferred from a missing or unresolvable contact record.
 *
 * Per §8 of D2-B-AUTH-REPAIR: unassigned contacts require admin. There is
 * no automatic assignment and no round-robin fallback.
 */
export async function checkMatchOwnership(
  actor: CommercialActor,
  leadId: string,
  supabase: SupabaseClient,
): Promise<OwnershipResult> {
  if (!leadId) {
    return { ok: false, status: 403, error: 'Match has no linked contact — ownership cannot be verified' }
  }

  const { data: contact } = await supabase
    .from('contacts')
    .select('agent_email')
    .eq('id', leadId)
    .single()

  if (!contact) {
    return { ok: false, status: 403, error: 'Contact not found for match — ownership cannot be verified' }
  }

  const ownerEmail = contact.agent_email?.trim().toLowerCase() ?? null

  if (ownerEmail === null) {
    if (!actor.isAdmin) {
      return {
        ok: false,
        status: 403,
        error: 'Contact is unassigned — only admin may perform commercial actions on unassigned contacts',
      }
    }
    return { ok: true }
  }

  const isOwner = ownerEmail === actor.email
  if (!isOwner && !actor.isAdmin) {
    return {
      ok: false,
      status: 403,
      error: 'Not authorized — this contact belongs to another agent',
    }
  }

  return { ok: true }
}
