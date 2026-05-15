// AGENCY GROUP — SH-ROS Security: Replay Authorization | AMI: 22506
// Phase Ω∞-1: All replays require explicit signed authorization
// Prevents replay poisoning and unauthorized event re-execution
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { signedAuditChain } from './signedAuditChain'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReplayStatus = 'pending' | 'approved' | 'executed' | 'rejected'

export interface ReplayAuthorizationRequest {
  org_id: string
  requested_by: string
  reason: string
  event_ids?: string[]
  from_ts?: string
  to_ts?: string
  metadata?: Record<string, unknown>
}

export interface ReplayAuthorization {
  replay_id: string
  org_id: string
  authorized_by: string
  reason: string
  event_ids: string[]
  from_ts: string | null
  to_ts: string | null
  status: ReplayStatus
  created_at: string
  executed_at: string | null
  metadata: Record<string, unknown>
}

// ─── Replay Authorization Engine ─────────────────────────────────────────────

export class ReplayAuthorizationEngine {
  /**
   * Request a replay authorization.
   * Returns the replay_id — must be approved before execution.
   */
  async requestAuthorization(req: ReplayAuthorizationRequest): Promise<string> {
    const replay_id = randomUUID()
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

    const { error } = await (sb.from('replay_authorizations') as {
      insert: (data: unknown) => Promise<{ error: unknown }>
    }).insert({
      replay_id,
      org_id: req.org_id,
      authorized_by: req.requested_by,
      reason: req.reason,
      event_ids: req.event_ids ?? [],
      from_ts: req.from_ts ?? null,
      to_ts: req.to_ts ?? null,
      status: 'pending',
      created_at: new Date().toISOString(),
      metadata: req.metadata ?? {},
    })

    if (error) {
      logger.error('[ReplayAuth] Request failed', { error, org_id: req.org_id })
      throw new Error(`ReplayAuth request failed: ${(error as { message: string }).message}`)
    }

    // Audit trail
    await signedAuditChain.append({
      entry_id: randomUUID(),
      org_id: req.org_id,
      actor: req.requested_by,
      action: 'replay_authorization_requested',
      entity_type: 'replay',
      entity_id: replay_id,
      metadata: { reason: req.reason, event_count: req.event_ids?.length ?? 0 },
    })

    logger.info('[ReplayAuth] Authorization requested', {
      replay_id, org_id: req.org_id, requested_by: req.requested_by,
    })

    return replay_id
  }

  /**
   * Approve a pending replay authorization.
   * In auto-approve mode (internal service calls), approver = 'system'.
   */
  async approve(replay_id: string, approver: string): Promise<void> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    const { data: existing } = await (sb.from('replay_authorizations') as {
      select: (c: string) => { eq: (a: string, b: string) => { single: () => Promise<{ data: ReplayAuthorization | null; error: unknown }> } }
    }).select('*').eq('replay_id', replay_id).single()

    if (!existing) throw new Error(`ReplayAuth: replay_id ${replay_id} not found`)
    if (existing.status !== 'pending') throw new Error(`ReplayAuth: cannot approve status=${existing.status}`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from('replay_authorizations') as any)
      .update({ status: 'approved' })
      .eq('replay_id', replay_id)

    if (error) throw new Error(`ReplayAuth approve failed: ${(error as { message: string }).message}`)

    await signedAuditChain.append({
      entry_id: randomUUID(),
      org_id: existing.org_id,
      actor: approver,
      action: 'replay_authorization_approved',
      entity_type: 'replay',
      entity_id: replay_id,
    })

    logger.info('[ReplayAuth] Approved', { replay_id, approver })
  }

  /**
   * Check if a replay is authorized before execution.
   * Call this inside the replay engine before processing any event.
   */
  async assertAuthorized(replay_id: string): Promise<ReplayAuthorization> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    const { data, error } = await (sb.from('replay_authorizations') as {
      select: (c: string) => { eq: (a: string, b: string) => { single: () => Promise<{ data: ReplayAuthorization | null; error: unknown }> } }
    }).select('*').eq('replay_id', replay_id).single()

    if (error || !data) {
      throw new ReplayNotAuthorizedError(replay_id, 'not_found')
    }
    if (data.status === 'pending') {
      throw new ReplayNotAuthorizedError(replay_id, 'pending_approval')
    }
    if (data.status === 'rejected') {
      throw new ReplayNotAuthorizedError(replay_id, 'rejected')
    }
    if (data.status === 'executed') {
      throw new ReplayNotAuthorizedError(replay_id, 'already_executed')
    }
    if (data.status !== 'approved') {
      throw new ReplayNotAuthorizedError(replay_id, `invalid_status:${data.status}`)
    }

    return data
  }

  /**
   * Mark a replay as executed (one-time use).
   */
  async markExecuted(replay_id: string, org_id: string, actor: string): Promise<void> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('replay_authorizations') as any)
      .update({ status: 'executed', executed_at: new Date().toISOString() })
      .eq('replay_id', replay_id)

    await signedAuditChain.append({
      entry_id: randomUUID(),
      org_id,
      actor,
      action: 'replay_executed',
      entity_type: 'replay',
      entity_id: replay_id,
    })

    logger.info('[ReplayAuth] Marked executed', { replay_id })
  }

  /**
   * Get all replay authorizations for an org.
   */
  async listForOrg(org_id: string, status?: ReplayStatus): Promise<ReplayAuthorization[]> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from('replay_authorizations') as any)
      .select('*')
      .eq('org_id', org_id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (status) q = q.eq('status', status)

    const { data, error } = await q
    if (error) return []
    return (data ?? []) as ReplayAuthorization[]
  }
}

export class ReplayNotAuthorizedError extends Error {
  constructor(public readonly replay_id: string, public readonly reason: string) {
    super(`Replay not authorized: replay_id=${replay_id} reason=${reason}`)
    this.name = 'ReplayNotAuthorizedError'
  }
}

export const replayAuthorizationEngine = new ReplayAuthorizationEngine()
