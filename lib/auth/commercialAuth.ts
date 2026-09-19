// =============================================================================
// Agency Group — Commercial Actor Authorization
// Phase 2C.D2-B-AUTH-REPAIR + D2-B-DEALPACK-AUTH
//
// Enforces the minimum human authorization boundary for sensitive commercial
// mutations: match review (D1), disclosure authorization/revocation (D2-A),
// and deal pack object-level access (D2-B-DEALPACK-AUTH).
//
// Model B:
//   Assigned contact (contacts.agent_email IS NOT NULL):
//     contact owner OR admin may act
//   Unassigned contact (contacts.agent_email IS NULL):
//     admin only — no fallback to any-agent
//
// is_active canonical semantics:
//   is_active = null  → active (NULL treated as active for historical rows)
//                        EXCEPTION: failClosed=true → denied
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

export type DealPackOwnershipResult =
  | { ok: true }
  | { ok: false; status: 403 | 404; error: string }

export interface ResolveActorOptions {
  /**
   * When true, is_active=NULL → denied.
   * Use for deal pack operations (§4 D2-B-DEALPACK-AUTH: FAIL CLOSED).
   * Default false: NULL treated as active (historical rows).
   */
  failClosed?: boolean
}

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
  options: ResolveActorOptions = {},
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

  if (options.failClosed && user.is_active === null) {
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
 *
 * Also used by deal pack generate route to verify contact ownership.
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

/**
 * Checks whether an actor is authorized to access or mutate a specific deal
 * pack. Authorization flows through:
 *   1. Admin → always authorized
 *   2. Pack creator (created_by == actor.email) → authorized
 *   3. Contact owner (pack.lead_id → contacts.agent_email == actor.email) → authorized
 *
 * Returns 404 if the pack does not exist (prevents enumeration via 403 vs 404).
 * Returns 403 if pack exists but actor is not authorized.
 */
export async function checkDealPackOwnership(
  actor: CommercialActor,
  packId: string,
  supabase: SupabaseClient,
): Promise<DealPackOwnershipResult> {
  if (!packId) {
    return { ok: false, status: 404, error: 'Deal pack not found' }
  }

  const { data: pack } = await supabase
    .from('deal_packs')
    .select('id, created_by, lead_id')
    .eq('id', packId)
    .single()

  if (!pack) {
    return { ok: false, status: 404, error: 'Deal pack not found' }
  }

  if (actor.isAdmin) return { ok: true }

  const creatorEmail = pack.created_by?.trim().toLowerCase() ?? null
  if (creatorEmail && creatorEmail === actor.email) return { ok: true }

  if (pack.lead_id) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('agent_email')
      .eq('id', pack.lead_id)
      .single()
    if (contact?.agent_email?.trim().toLowerCase() === actor.email) return { ok: true }
  }

  return { ok: false, status: 403, error: 'Not authorized — this deal pack belongs to another agent' }
}
