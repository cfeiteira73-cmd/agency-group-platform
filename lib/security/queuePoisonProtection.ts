// AGENCY GROUP — SH-ROS Security: Queue Poison Protection | AMI: 22506
// Phase Ω∞-1: Detects and quarantines poisoned queue messages
// Prevents runaway loops and malformed event injection
// =============================================================================

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PoisonDetectionResult {
  is_poison: boolean
  reason?: string
  fingerprint: string
}

export interface QuarantinedMessage {
  id: string
  original_id: string
  queue_name: string
  org_id: string | null
  payload: Record<string, unknown>
  failure_reason: string
  failure_count: number
  first_seen_at: string
  last_seen_at: string
  resolved: boolean
}

// ─── Detection Rules ──────────────────────────────────────────────────────────

const POISON_RULES: Array<{
  name: string
  check: (payload: Record<string, unknown>) => boolean
}> = [
  {
    name: 'oversized_payload',
    check: (p) => JSON.stringify(p).length > 1_000_000,  // 1MB limit
  },
  {
    name: 'recursive_event_chain',
    check: (p) => {
      const chain = p['event_chain'] as string[] | undefined
      return Array.isArray(chain) && chain.length > 50
    },
  },
  {
    name: 'missing_required_fields',
    check: (p) => {
      // All runtime events must have event_id and event_type
      return !p['event_id'] || !p['event_type']
    },
  },
  {
    name: 'invalid_org_id',
    check: (p) => {
      const org = p['org_id']
      // org_id must be non-empty string or null (single-tenant)
      return org !== undefined && org !== null && typeof org !== 'string'
    },
  },
  {
    name: 'future_timestamp_overflow',
    check: (p) => {
      const ts = p['timestamp'] as string | undefined
      if (!ts) return false
      const t = new Date(ts).getTime()
      return t > Date.now() + 86_400_000 * 365  // more than 1 year in future
    },
  },
  {
    name: 'injection_pattern',
    check: (p) => {
      const str = JSON.stringify(p)
      // Basic injection detection: SQL, script injection
      return /(\bDROP\b|\bDELETE\b|\bTRUNCATE\b|\bINSERT\b\s+INTO|<script|javascript:)/i.test(str)
    },
  },
]

// ─── Poison Protection Engine ─────────────────────────────────────────────────

export class QueuePoisonProtection {
  // In-memory fingerprint counter: fingerprint → { count, first_seen }
  private _fingerprints = new Map<string, { count: number; first_seen: number }>()
  private readonly REPEAT_POISON_THRESHOLD = 3   // 3 identical failures = poison
  private readonly FINGERPRINT_TTL = 3_600_000   // 1 hour

  /**
   * Inspect a message payload for poison indicators.
   * Call before processing any queue message.
   */
  inspect(
    queue_name: string,
    original_id: string,
    payload: Record<string, unknown>
  ): PoisonDetectionResult {
    const fingerprint = this._fingerprint(queue_name, payload)

    // Check static rules
    for (const rule of POISON_RULES) {
      if (rule.check(payload)) {
        return { is_poison: true, reason: rule.name, fingerprint }
      }
    }

    // Check repeat failures
    this._cleanOldFingerprints()
    const existing = this._fingerprints.get(fingerprint)
    if (existing && existing.count >= this.REPEAT_POISON_THRESHOLD) {
      return { is_poison: true, reason: `repeat_failure:${existing.count}`, fingerprint }
    }

    return { is_poison: false, fingerprint }
  }

  /**
   * Record a processing failure for a message.
   * Increments repeat failure counter.
   */
  recordFailure(
    queue_name: string,
    payload: Record<string, unknown>,
    reason: string
  ): number {
    const fingerprint = this._fingerprint(queue_name, payload)
    const existing = this._fingerprints.get(fingerprint)

    const count = (existing?.count ?? 0) + 1
    this._fingerprints.set(fingerprint, {
      count,
      first_seen: existing?.first_seen ?? Date.now(),
    })

    logger.warn('[QueuePoison] Failure recorded', { queue_name, fingerprint, count, reason })
    return count
  }

  /**
   * Quarantine a poisoned message to the DB.
   */
  async quarantine(opts: {
    original_id: string
    queue_name: string
    org_id: string | null
    payload: Record<string, unknown>
    failure_reason: string
  }): Promise<void> {
    const fingerprint = this._fingerprint(opts.queue_name, opts.payload)
    const existing_count = this._fingerprints.get(fingerprint)?.count ?? 1
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

    // Try to upsert (may already be quarantined from previous attempt)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (sb.from('queue_poison_quarantine') as any)
      .select('id, failure_count')
      .eq('original_id', opts.original_id)
      .eq('queue_name', opts.queue_name)
      .maybeSingle()

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from('queue_poison_quarantine') as any)
        .update({
          failure_count: (existing.failure_count as number) + 1,
          last_seen_at: new Date().toISOString(),
          failure_reason: opts.failure_reason,
        })
        .eq('id', existing.id)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb.from('queue_poison_quarantine') as any)
        .insert({
          original_id: opts.original_id,
          queue_name: opts.queue_name,
          org_id: opts.org_id,
          payload: opts.payload,
          failure_reason: opts.failure_reason,
          failure_count: existing_count,
          first_seen_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          resolved: false,
        })

      if (error) {
        logger.error('[QueuePoison] Quarantine insert failed', { error, original_id: opts.original_id })
      }
    }

    logger.error('[QueuePoison] Message quarantined', {
      original_id: opts.original_id,
      queue_name: opts.queue_name,
      org_id: opts.org_id,
      failure_reason: opts.failure_reason,
    })
  }

  /**
   * List unresolved quarantined messages.
   */
  async listQuarantined(queue_name?: string): Promise<QuarantinedMessage[]> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from('queue_poison_quarantine') as any)
      .select('*')
      .eq('resolved', false)
      .order('first_seen_at', { ascending: false })
      .limit(100)

    if (queue_name) q = q.eq('queue_name', queue_name)
    const { data, error } = await q

    if (error) {
      logger.error('[QueuePoison] listQuarantined failed', { error })
      return []
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((row: any) => ({
      id: row.id as string,
      original_id: row.original_id as string,
      queue_name: row.queue_name as string,
      org_id: row.org_id as string | null,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      failure_reason: row.failure_reason as string,
      failure_count: row.failure_count as number,
      first_seen_at: row.first_seen_at as string,
      last_seen_at: row.last_seen_at as string,
      resolved: row.resolved as boolean,
    }))
  }

  /**
   * Resolve a quarantined message (manual review complete).
   */
  async resolve(id: string, resolved_by: string): Promise<void> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('queue_poison_quarantine') as any)
      .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by })
      .eq('id', id)

    logger.info('[QueuePoison] Message resolved', { id, resolved_by })
  }

  private _fingerprint(queue_name: string, payload: Record<string, unknown>): string {
    // Fingerprint on queue + event_type + org_id (ignore dynamic fields like timestamps)
    const key = `${queue_name}:${payload['event_type'] ?? 'unknown'}:${payload['org_id'] ?? 'none'}`
    return createHash('sha256').update(key).digest('hex').slice(0, 16)
  }

  private _cleanOldFingerprints(): void {
    const cutoff = Date.now() - this.FINGERPRINT_TTL
    for (const [key, val] of this._fingerprints.entries()) {
      if (val.first_seen < cutoff) this._fingerprints.delete(key)
    }
  }
}

export const queuePoisonProtection = new QueuePoisonProtection()
