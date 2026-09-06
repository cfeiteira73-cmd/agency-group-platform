// =============================================================================
// Phase 2B.2 — Demand Mandate Service Layer
// All DB operations use supabaseAdmin (service role — mandate tables are
// RLS service_role-only). Authorization is performed BEFORE reaching this layer.
//
// Atomicity: multi-table creation goes via create_demand_mandate_v1 RPC.
// Single-table updates (PATCH core, add/remove subresource) are atomic by default.
//
// Activity projection: best-effort (canonical mandate operation never fails due
// to a secondary activity insert). Activity failures are logged, not thrown.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import type {
  DemandMandate, FullMandate, DemandMandateParticipant,
  DemandMandateLocation, DemandMandateCriterion, DemandMandateHistory,
  BuyerMandateDetails, InvestorMandateDetails,
  MandateLifecycleState,
} from '@/lib/database.types'
import {
  validateDemandMandate, validateBuyerMandateDetails,
  validateInvestorMandateDetails, validateLifecycleTransition,
  validateConstraintType, validateLocationMode,
} from './mandateValidation'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateMandatePayload {
  holder_contact_id:  number
  owner_id:           string
  transaction_mode:   string
  purpose:            string
  lifecycle_state?:   string
  budget_min?:        number | null
  budget_max?:        number | null
  currency_code?:     string
  budget_provenance?: string
  origin?:            string
  notes?:             string | null
  expires_at?:        string | null
  mandate_type?:      'buyer' | 'investor'
  buyer_details?:     Partial<Omit<BuyerMandateDetails, 'mandate_id' | 'created_at' | 'updated_at'>>
  investor_details?:  Partial<Omit<InvestorMandateDetails, 'mandate_id' | 'created_at' | 'updated_at'>>
  locations?:         Array<{ geography_node_id: string; mode?: string; preference_weight?: number }>
  criteria?:          Array<{ criterion_key: string; criterion_val: string; constraint_type?: string; provenance?: string }>
  participants?:      Array<{ contact_id: number; role?: string }>
}

export interface MandateServiceResult<T = void> {
  ok:    boolean
  data?: T
  error?: string
}

// ── Validation helpers ─────────────────────────────────────────────────────────

function validationError(msgs: string[]): MandateServiceResult<never> {
  return { ok: false, error: msgs.join('; ') }
}

// ── Mandate Creation ───────────────────────────────────────────────────────────

export async function createMandate(
  payload: CreateMandatePayload,
): Promise<MandateServiceResult<{ mandate_id: string }>> {
  // Input validation (pure, no DB)
  const coreValidation = validateDemandMandate({
    holder_contact_id: payload.holder_contact_id,
    owner_id:          payload.owner_id,
    transaction_mode:  payload.transaction_mode,
    purpose:           payload.purpose,
    lifecycle_state:   payload.lifecycle_state,
    budget_min:        payload.budget_min,
    budget_max:        payload.budget_max,
    currency_code:     payload.currency_code,
    budget_provenance: payload.budget_provenance,
    origin:            payload.origin,
    expires_at:        payload.expires_at,
  })
  if (!coreValidation.ok) return validationError(coreValidation.errors)

  if (payload.buyer_details) {
    const bv = validateBuyerMandateDetails(payload.buyer_details as Parameters<typeof validateBuyerMandateDetails>[0])
    if (!bv.ok) return validationError(bv.errors)
  }
  if (payload.investor_details) {
    const iv = validateInvestorMandateDetails(payload.investor_details as Parameters<typeof validateInvestorMandateDetails>[0])
    if (!iv.ok) return validationError(iv.errors)
  }

  // Call atomic RPC
  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
    'create_demand_mandate_v1',
    { p_payload: payload as unknown as Record<string, unknown> },
  )

  if (rpcError) {
    console.error('[mandateService] RPC error:', rpcError)
    return { ok: false, error: rpcError.message }
  }

  const result = rpcData as { ok: boolean; mandate_id?: string; error?: string }
  if (!result?.ok) {
    console.error('[mandateService] RPC returned error:', result?.error)
    return { ok: false, error: result?.error ?? 'RPC failed' }
  }

  return { ok: true, data: { mandate_id: result.mandate_id! } }
}

// ── Mandate Fetch ──────────────────────────────────────────────────────────────

export async function getMandateById(mandateId: string): Promise<MandateServiceResult<FullMandate>> {
  const { data, error } = await supabaseAdmin
    .from('demand_mandates')
    .select(`
      *,
      buyer_details:buyer_mandate_details(*),
      investor_details:investor_mandate_details(*),
      locations:demand_mandate_locations(*, geography_node:geography_nodes(*)),
      criteria:demand_mandate_criteria(*),
      participants:demand_mandate_participants(*)
    `)
    .eq('id', mandateId)
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as unknown as FullMandate }
}

export async function getMandatesByContactId(
  holderContactId: number,
  filters?: { lifecycle_state?: MandateLifecycleState }
): Promise<MandateServiceResult<DemandMandate[]>> {
  let query = supabaseAdmin
    .from('demand_mandates')
    .select('*')
    .eq('holder_contact_id', holderContactId)
    .order('created_at', { ascending: false })

  if (filters?.lifecycle_state) {
    query = query.eq('lifecycle_state', filters.lifecycle_state)
  }

  const { data, error } = await query
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as unknown as DemandMandate[] }
}

// ── Mandate Update (core fields only) ─────────────────────────────────────────

type MandatePatchFields = Partial<Pick<DemandMandate,
  | 'notes' | 'expires_at' | 'budget_min' | 'budget_max'
  | 'currency_code' | 'budget_provenance' | 'paused_reason'
  | 'cancelled_reason'
>>

export async function patchMandate(
  mandateId: string,
  ownerId: string,
  patch: MandatePatchFields,
): Promise<MandateServiceResult<DemandMandate>> {
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'No fields to update' }
  }

  const { data, error } = await supabaseAdmin
    .from('demand_mandates')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', mandateId)
    .eq('owner_id', ownerId)
    .select()
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as unknown as DemandMandate }
}

// ── Lifecycle Operations ───────────────────────────────────────────────────────

const LIFECYCLE_ACTIVITY_EVENTS: Partial<Record<MandateLifecycleState, string>> = {
  ACTIVE:    'Mandato activado',
  PAUSED:    'Mandato suspenso',
  COMPLETED: 'Mandato concluído',
  CANCELLED: 'Mandato cancelado',
}

export async function transitionMandateLifecycle(
  mandateId: string,
  ownerId: string,
  targetState: MandateLifecycleState,
  holderContactId: number,
  reason?: string,
): Promise<MandateServiceResult<DemandMandate>> {
  // Fetch current state
  const { data: current, error: fetchErr } = await supabaseAdmin
    .from('demand_mandates')
    .select('lifecycle_state, owner_id')
    .eq('id', mandateId)
    .single()

  if (fetchErr || !current) return { ok: false, error: fetchErr?.message ?? 'Mandate not found' }

  const transition = validateLifecycleTransition(current.lifecycle_state, targetState)
  if (!transition.ok) return validationError(transition.errors)

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { lifecycle_state: targetState, updated_at: now }

  if (targetState === 'CANCELLED') {
    patch.cancelled_at = now
    if (reason) patch.cancelled_reason = reason
  } else if (targetState === 'COMPLETED') {
    patch.completed_at = now
  } else if (targetState === 'PAUSED') {
    patch.paused_at = now
    if (reason) patch.paused_reason = reason
  }

  const { data, error } = await supabaseAdmin
    .from('demand_mandates')
    .update(patch)
    .eq('id', mandateId)
    .eq('owner_id', ownerId)
    .select()
    .single()

  if (error) return { ok: false, error: error.message }

  // Best-effort activity projection — mandate state change is canonical regardless
  const activityLabel = LIFECYCLE_ACTIVITY_EVENTS[targetState]
  if (activityLabel) {
    supabaseAdmin.from('activities').insert({
      contact_id:    String(holderContactId),
      type:          'note',
      subject:       activityLabel,
      is_automated:  true,
      metadata:      {
        mandate_id:         mandateId,
        mandate_event_type: 'LIFECYCLE_CHANGE',
        lifecycle_state:    targetState,
        source:             'demand_mandate_system',
      },
      occurred_at:   now,
    }).then(({ error: actErr }) => {
      if (actErr) console.warn('[mandateService] Activity projection failed (non-fatal):', actErr.message)
    })
  }

  return { ok: true, data: data as DemandMandate }
}

// ── Locations ─────────────────────────────────────────────────────────────────

export async function addLocation(
  mandateId: string,
  ownerId: string,
  input: { geography_node_id: string; mode?: string; preference_weight?: number },
): Promise<MandateServiceResult<DemandMandateLocation>> {
  const modeResult = validateLocationMode(input.mode ?? 'INCLUDE')
  if (!modeResult.ok) return validationError(modeResult.errors)

  // Ownership check
  const { data: mandate, error: mErr } = await supabaseAdmin
    .from('demand_mandates')
    .select('owner_id')
    .eq('id', mandateId)
    .single()
  if (mErr || !mandate) return { ok: false, error: 'Mandate not found' }
  if (mandate.owner_id !== ownerId) return { ok: false, error: 'Forbidden' }

  const { data, error } = await supabaseAdmin
    .from('demand_mandate_locations')
    .insert({
      mandate_id:        mandateId,
      geography_node_id: input.geography_node_id,
      mode:              input.mode ?? 'INCLUDE',
      preference_weight: input.preference_weight ?? 50,
    })
    .select()
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as unknown as DemandMandateLocation }
}

export async function removeLocation(
  locationId: string,
  mandateId: string,
  ownerId: string,
): Promise<MandateServiceResult> {
  // Ownership check via join
  const { data: loc, error: lErr } = await supabaseAdmin
    .from('demand_mandate_locations')
    .select('id, mandate:demand_mandates(owner_id)')
    .eq('id', locationId)
    .eq('mandate_id', mandateId)
    .single()

  if (lErr || !loc) return { ok: false, error: 'Location not found' }
  const locData = loc as unknown as { id: string; mandate: { owner_id: string } | null }
  if (locData.mandate?.owner_id !== ownerId) return { ok: false, error: 'Forbidden' }

  const { error } = await supabaseAdmin.from('demand_mandate_locations').delete().eq('id', locationId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Criteria ─────────────────────────────────────────────────────────────────

export async function addCriterion(
  mandateId: string,
  ownerId: string,
  input: { criterion_key: string; criterion_val: string; constraint_type?: string; provenance?: string },
): Promise<MandateServiceResult<DemandMandateCriterion>> {
  const ctResult = validateConstraintType(input.constraint_type ?? 'HARD')
  if (!ctResult.ok) return validationError(ctResult.errors)

  const { data: mandate, error: mErr } = await supabaseAdmin
    .from('demand_mandates')
    .select('owner_id')
    .eq('id', mandateId)
    .single()
  if (mErr || !mandate) return { ok: false, error: 'Mandate not found' }
  if (mandate.owner_id !== ownerId) return { ok: false, error: 'Forbidden' }

  const { data, error } = await supabaseAdmin
    .from('demand_mandate_criteria')
    .insert({
      mandate_id:      mandateId,
      criterion_key:   input.criterion_key,
      criterion_val:   input.criterion_val,
      constraint_type: input.constraint_type ?? 'HARD',
      provenance:      input.provenance ?? 'AGENT_VERIFIED',
    })
    .select()
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as unknown as DemandMandateCriterion }
}

export async function removeCriterion(
  criterionId: string,
  mandateId: string,
  ownerId: string,
): Promise<MandateServiceResult> {
  const { data: crit, error: cErr } = await supabaseAdmin
    .from('demand_mandate_criteria')
    .select('id, mandate:demand_mandates(owner_id)')
    .eq('id', criterionId)
    .eq('mandate_id', mandateId)
    .single()

  if (cErr || !crit) return { ok: false, error: 'Criterion not found' }
  const critData = crit as unknown as { id: string; mandate: { owner_id: string } | null }
  if (critData.mandate?.owner_id !== ownerId) return { ok: false, error: 'Forbidden' }

  const { error } = await supabaseAdmin.from('demand_mandate_criteria').delete().eq('id', criterionId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Participants ─────────────────────────────────────────────────────────────

export async function addParticipant(
  mandateId: string,
  ownerId: string,
  input: { contact_id: number; role?: string; notes?: string | null },
): Promise<MandateServiceResult<DemandMandateParticipant>> {
  const { data: mandate, error: mErr } = await supabaseAdmin
    .from('demand_mandates')
    .select('owner_id')
    .eq('id', mandateId)
    .single()
  if (mErr || !mandate) return { ok: false, error: 'Mandate not found' }
  if (mandate.owner_id !== ownerId) return { ok: false, error: 'Forbidden' }

  const { data, error } = await supabaseAdmin
    .from('demand_mandate_participants')
    .insert({
      mandate_id: mandateId,
      contact_id: input.contact_id,
      role:       input.role ?? 'DECISION_MAKER',
      notes:      input.notes ?? null,
    })
    .select()
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as unknown as DemandMandateParticipant }
}

// ── History ─────────────────────────────────────────────────────────────────

export async function getMandateHistory(
  mandateId: string,
): Promise<MandateServiceResult<DemandMandateHistory[]>> {
  const { data, error } = await supabaseAdmin
    .from('demand_mandate_history')
    .select('*')
    .eq('mandate_id', mandateId)
    .order('changed_at', { ascending: true })

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as unknown as DemandMandateHistory[] }
}

// ── Authorization helper (used by API routes) ──────────────────────────────────

/**
 * Verifies that a session user has CRM access to a contact.
 * Admin: access to all contacts.
 * Non-admin: only contacts where assigned_to = session.user.id.
 *
 * Returns: { ok: true, contact } | { ok: false, error, status }
 */
export async function verifyContactAccess(
  contactId: number,
  sessionUserId: string,
  sessionUserRole: string,
): Promise<{ ok: boolean; contact?: { id: number; assigned_to: string | null }; error?: string; status?: number }> {
  const { data: contact, error } = await supabaseAdmin
    .from('contacts')
    .select('id, assigned_to')
    .eq('id', contactId as unknown as string)
    .single()

  if (error || !contact) {
    return { ok: false, error: 'Contact not found', status: 404 }
  }

  if (sessionUserRole !== 'admin' && contact.assigned_to !== sessionUserId) {
    return { ok: false, error: 'You do not have access to this contact', status: 403 }
  }

  return { ok: true, contact: contact as unknown as { id: number; assigned_to: string | null } }
}

/**
 * Verifies that a session user owns a mandate (or is admin).
 * Used for GET/PATCH/subresource operations.
 */
export async function verifyMandateAccess(
  mandateId: string,
  sessionUserId: string,
  sessionUserRole: string,
): Promise<{ ok: boolean; mandate?: Pick<DemandMandate, 'id' | 'owner_id' | 'holder_contact_id'>; error?: string; status?: number }> {
  const { data: mandate, error } = await supabaseAdmin
    .from('demand_mandates')
    .select('id, owner_id, holder_contact_id')
    .eq('id', mandateId)
    .single()

  if (error || !mandate) {
    return { ok: false, error: 'Mandate not found', status: 404 }
  }

  const m = mandate as Pick<DemandMandate, 'id' | 'owner_id' | 'holder_contact_id'>

  if (sessionUserRole !== 'admin') {
    // Owner can access their own mandate
    if (m.owner_id === sessionUserId) return { ok: true, mandate: m }

    // Or if the holder contact is assigned to this agent
    const contactAccess = await verifyContactAccess(m.holder_contact_id, sessionUserId, sessionUserRole)
    if (!contactAccess.ok) {
      return { ok: false, error: 'Mandate not found', status: 404 } // IDOR: don't reveal mandate exists
    }
    return { ok: true, mandate: m }
  }

  return { ok: true, mandate: m }
}

/**
 * Verifies a profile row exists for the session user.
 * Mandate creation fails honestly if no profile exists.
 */
export async function verifyProfileExists(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single()
  return !!data
}
