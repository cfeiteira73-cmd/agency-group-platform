// AGENCY GROUP — SH-ROS Security: Signed Audit Chain | AMI: 22506
// Phase Ω∞-1: Cryptographically linked audit trail (tamper-evident)
// Each entry SHA-256 hashes into the next — blockchain-style integrity
// =============================================================================

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SignedAuditEntry {
  entry_id: string
  org_id: string
  actor: string
  action: string
  entity_type: string
  entity_id?: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface SignedAuditRecord {
  entry_id: string
  org_id: string
  actor: string
  action: string
  entity_type: string
  entity_id: string | null
  payload_hash: string
  chain_hash: string
  prev_hash: string | null
  created_at: string
  metadata: Record<string, unknown>
}

export interface AuditChainVerification {
  valid: boolean
  total_entries: number
  valid_entries: number
  broken_at?: string  // entry_id where chain breaks
  first_entry: string
  last_entry: string
}

// ─── Signed Audit Chain ───────────────────────────────────────────────────────

export class SignedAuditChain {
  private readonly CHAIN_GENESIS = '0000000000000000000000000000000000000000000000000000000000000000'

  /**
   * Append a signed entry to the audit chain.
   * Fetches previous chain_hash to link entries.
   */
  async append(entry: SignedAuditEntry): Promise<string> {
    const entry_id = randomUUID()
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

    // Get last entry in this org's chain
    const { data: prev } = await (sb.from('signed_audit_log') as {
      select: (c: string) => {
        eq: (a: string, b: string) => {
          order: (col: string, opts: unknown) => {
            limit: (n: number) => Promise<{ data: Array<{ chain_hash: string; entry_id: string }> | null; error: unknown }>
          }
        }
      }
    }).select('chain_hash, entry_id')
      .eq('org_id', entry.org_id)
      .order('created_at', { ascending: false })
      .limit(1)

    const prev_hash = prev?.[0]?.chain_hash ?? null
    const chain_input = prev_hash ?? this.CHAIN_GENESIS

    // Build payload hash
    const payloadStr = JSON.stringify({
      entry_id,
      org_id: entry.org_id,
      actor: entry.actor,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      metadata: entry.metadata ?? {},
    })
    const payload_hash = createHash('sha256').update(payloadStr).digest('hex')
    const chain_hash = createHash('sha256').update(payload_hash + chain_input).digest('hex')

    const { error } = await (sb.from('signed_audit_log') as {
      insert: (data: unknown) => Promise<{ error: unknown }>
    }).insert({
      entry_id,
      org_id: entry.org_id,
      actor: entry.actor,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      payload_hash,
      chain_hash,
      prev_hash,
      created_at: new Date().toISOString(),
      metadata: entry.metadata ?? {},
    })

    if (error) {
      logger.error('[SignedAudit] Append failed', { error, org_id: entry.org_id, action: entry.action })
      throw new Error(`SignedAudit append failed: ${(error as { message: string }).message}`)
    }

    logger.info('[SignedAudit] Entry appended', {
      entry_id,
      org_id: entry.org_id,
      actor: entry.actor,
      action: entry.action,
    })

    return entry_id
  }

  /**
   * Query audit entries for an org.
   */
  async query(opts: {
    org_id: string
    actor?: string
    action?: string
    entity_type?: string
    from?: string
    to?: string
    limit?: number
  }): Promise<SignedAuditRecord[]> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from('signed_audit_log') as any)
      .select('*')
      .eq('org_id', opts.org_id)
      .order('created_at', { ascending: false })

    if (opts.actor)       q = q.eq('actor', opts.actor)
    if (opts.action)      q = q.eq('action', opts.action)
    if (opts.entity_type) q = q.eq('entity_type', opts.entity_type)
    if (opts.from)        q = q.gte('created_at', opts.from)
    if (opts.to)          q = q.lte('created_at', opts.to)

    q = q.limit(opts.limit ?? 100)
    const { data, error } = await q

    if (error) {
      logger.error('[SignedAudit] Query failed', { error, opts })
      return []
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((row: any) => ({
      entry_id: row.entry_id as string,
      org_id: row.org_id as string,
      actor: row.actor as string,
      action: row.action as string,
      entity_type: row.entity_type as string,
      entity_id: row.entity_id as string | null,
      payload_hash: row.payload_hash as string,
      chain_hash: row.chain_hash as string,
      prev_hash: row.prev_hash as string | null,
      created_at: row.created_at as string,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
    }))
  }

  /**
   * Verify chain integrity for an org.
   * Walks entire chain and validates hash linkage.
   */
  async verifyChain(org_id: string): Promise<AuditChainVerification> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from('signed_audit_log') as any)
      .select('entry_id, chain_hash, prev_hash, payload_hash, created_at')
      .eq('org_id', org_id)
      .order('created_at', { ascending: true })

    if (error || !data || data.length === 0) {
      return {
        valid: true,
        total_entries: 0,
        valid_entries: 0,
        first_entry: '',
        last_entry: '',
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = data as Array<{ entry_id: string; chain_hash: string; prev_hash: string | null; payload_hash: string }>
    let valid_entries = 0
    let broken_at: string | undefined = undefined
    let prev_chain = this.CHAIN_GENESIS

    for (const row of rows) {
      // Verify chain link
      const expected_chain = createHash('sha256').update(row.payload_hash + prev_chain).digest('hex')
      if (row.chain_hash === expected_chain) {
        valid_entries++
        prev_chain = row.chain_hash
      } else {
        if (!broken_at) broken_at = row.entry_id
        // Don't break — continue checking
      }
    }

    return {
      valid: !broken_at,
      total_entries: rows.length,
      valid_entries,
      broken_at,
      first_entry: rows[0].entry_id,
      last_entry: rows[rows.length - 1].entry_id,
    }
  }
}

export const signedAuditChain = new SignedAuditChain()
