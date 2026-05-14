// AGENCY GROUP — SH-ROS Compliance: immutableAudit | AMI: 22506
import { randomUUID, createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

export interface AuditEntry {
  entry_id: string
  org_id: string
  timestamp: string
  actor: string
  action: string
  entity_type: string
  entity_id?: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  hash: string
  metadata: Record<string, unknown>
}

export interface AuditQuery {
  org_id?: string
  actor?: string
  action?: string
  from?: string
  to?: string
  entity_type?: string
  limit?: number
}

export class ImmutableAuditLog {
  private _computeHash(entry: Omit<AuditEntry, 'hash'>): string {
    const payload = [
      entry.entry_id, entry.timestamp, entry.actor, entry.action,
      JSON.stringify(entry.before ?? {}), JSON.stringify(entry.after ?? {}),
    ].join('|')
    return createHash('sha256').update(payload).digest('hex')
  }

  async append(entry: Omit<AuditEntry, 'hash'>): Promise<void> {
    const hash = this._computeHash(entry)
    const fullEntry: AuditEntry = { ...entry, hash }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin.from('learning_events') as any).insert({
        event_type:    'immutable_audit',
        source_system: 'agent',
        metadata:      fullEntry,
      })
    } catch (err) {
      console.warn('[ImmutableAuditLog] append failed:', err instanceof Error ? err.message : String(err))
      throw err // Re-throw — audit failures should not be silent
    }
  }

  async query(filters: AuditQuery): Promise<AuditEntry[]> {
    try {
      const since = filters.from ?? new Date(Date.now() - 365 * 86_400_000).toISOString()
      const q = supabaseAdmin
        .from('learning_events')
        .select('metadata, created_at')
        .eq('event_type', 'immutable_audit')
        .gte('created_at', since)

      if (filters.to) q.lte('created_at', filters.to)

      const { data } = await q.order('created_at', { ascending: false }).limit(filters.limit ?? 100)

      return (data ?? [])
        .map(r => r.metadata as unknown as AuditEntry)
        .filter(e => {
          if (!e) return false
          if (filters.org_id     && e.org_id      !== filters.org_id)     return false
          if (filters.actor      && e.actor        !== filters.actor)      return false
          if (filters.action     && e.action       !== filters.action)     return false
          if (filters.entity_type && e.entity_type !== filters.entity_type) return false
          return true
        })
    } catch { return [] }
  }

  async verify(entry_id: string): Promise<{ valid: boolean; hash_matches: boolean }> {
    try {
      const entries = await this.query({ limit: 500 })
      const entry   = entries.find(e => e.entry_id === entry_id)
      if (!entry) return { valid: false, hash_matches: false }

      const { hash, ...rest } = entry
      const expected = this._computeHash(rest)
      return { valid: true, hash_matches: hash === expected }
    } catch { return { valid: false, hash_matches: false } }
  }

  async getCount(org_id?: string): Promise<number> {
    try {
      const entries = await this.query({ org_id, limit: 10000 })
      return entries.length
    } catch { return 0 }
  }

  static createEntry(
    org_id: string, actor: string, action: string, entity_type: string,
    opts: { entity_id?: string; before?: Record<string, unknown>; after?: Record<string, unknown>; metadata?: Record<string, unknown> } = {},
  ): Omit<AuditEntry, 'hash'> {
    return {
      entry_id:    randomUUID(),
      org_id, actor, action, entity_type,
      entity_id:   opts.entity_id,
      before:      opts.before,
      after:       opts.after,
      timestamp:   new Date().toISOString(),
      metadata:    opts.metadata ?? {},
    }
  }
}

export const immutableAuditLog = new ImmutableAuditLog()
