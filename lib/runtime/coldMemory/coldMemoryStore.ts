// AGENCY GROUP — SH-ROS coldMemory: coldMemoryStore | AMI: 22506
// Cold memory abstraction — DB-backed archive via learning_events, tenant-isolated
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MemoryArchiveType =
  | 'event'
  | 'workflow'
  | 'agent_result'
  | 'kpi_snapshot'
  | 'learning_outcome'

export interface MemoryArchiveEntry {
  id: string
  org_id: string
  type: MemoryArchiveType
  data: Record<string, unknown>
  event_timestamp: string
  archived_at: string
  trace_id?: string
  event_chain?: string[]
  compressed: boolean
  retention_days: number
  tags: string[]
}

export interface ColdMemoryQuery {
  org_id?: string
  type?: string
  from?: string
  to?: string
  tags?: string[]
  trace_id?: string
  event_chain?: string[]
  limit?: number
  offset?: number
}

export interface RetentionStats {
  org_id: string
  total_entries: number
  oldest_entry: string
  newest_entry: string
  size_estimate_bytes: number
  by_type: Record<string, number>
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IColdMemoryStore {
  archive(entry: MemoryArchiveEntry): Promise<void>
  query(opts: ColdMemoryQuery): Promise<MemoryArchiveEntry[]>
  count(opts: Partial<ColdMemoryQuery>): Promise<number>
  delete(entry_ids: string[]): Promise<number>
  getRetentionStats(org_id: string): Promise<RetentionStats>
}

// ─── DB Implementation ────────────────────────────────────────────────────────

export class DBColdMemoryStore implements IColdMemoryStore {
  /**
   * Archive a memory entry.
   * Stored in learning_events with event_type='cold_archive'.
   */
  async archive(entry: MemoryArchiveEntry): Promise<void> {
    const now = new Date().toISOString()
    const id = entry.id || randomUUID()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin.from('learning_events') as any).insert({
      event_type: 'cold_archive',
      org_id: entry.org_id,
      metadata: {
        archive_id: id,
        type: entry.type,
        data: entry.data,
        event_timestamp: entry.event_timestamp,
        archived_at: entry.archived_at || now,
        trace_id: entry.trace_id ?? null,
        event_chain: entry.event_chain ?? [],
        compressed: entry.compressed,
        retention_days: entry.retention_days,
        tags: entry.tags,
      },
      created_at: now,
    })

    if (error) {
      logger.error('[ColdMemoryStore] Archive failed', { error, id, org_id: entry.org_id })
      throw new Error(`Cold archive failed: ${error.message}`)
    }

    logger.info('[ColdMemoryStore] Entry archived', {
      id,
      type: entry.type,
      org_id: entry.org_id,
    })
  }

  /**
   * Query archived entries with tenant isolation.
   */
  async query(opts: ColdMemoryQuery): Promise<MemoryArchiveEntry[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabaseAdmin.from('learning_events') as any)
      .select('metadata, org_id, created_at')
      .eq('event_type', 'cold_archive')

    if (opts.org_id) {
      q = q.eq('org_id', opts.org_id)
    }
    if (opts.type) {
      q = q.contains('metadata', { type: opts.type })
    }
    if (opts.trace_id) {
      q = q.contains('metadata', { trace_id: opts.trace_id })
    }
    if (opts.from) {
      q = q.gte('created_at', opts.from)
    }
    if (opts.to) {
      q = q.lte('created_at', opts.to)
    }

    q = q
      .order('created_at', { ascending: false })
      .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 100) - 1)

    const { data, error } = await q

    if (error) {
      logger.error('[ColdMemoryStore] Query failed', { error, opts })
      return []
    }

    return (data ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((row: any) => {
        const meta = row.metadata as Record<string, unknown>

        // Filter tags in-memory (Supabase JSON array contains is limited)
        if (opts.tags && opts.tags.length > 0) {
          const entryTags = (meta['tags'] as string[]) ?? []
          const hasAll = opts.tags.every((t) => entryTags.includes(t))
          if (!hasAll) return null
        }

        // Filter event_chain in-memory
        if (opts.event_chain && opts.event_chain.length > 0) {
          const chain = (meta['event_chain'] as string[]) ?? []
          const intersects = opts.event_chain.some((e) => chain.includes(e))
          if (!intersects) return null
        }

        return {
          id: meta['archive_id'] as string,
          org_id: row.org_id as string,
          type: meta['type'] as MemoryArchiveType,
          data: (meta['data'] as Record<string, unknown>) ?? {},
          event_timestamp: meta['event_timestamp'] as string,
          archived_at: meta['archived_at'] as string,
          trace_id: meta['trace_id'] as string | undefined,
          event_chain: (meta['event_chain'] as string[]) ?? [],
          compressed: Boolean(meta['compressed']),
          retention_days: (meta['retention_days'] as number) ?? 365,
          tags: (meta['tags'] as string[]) ?? [],
        } satisfies MemoryArchiveEntry
      })
      .filter((e: MemoryArchiveEntry | null): e is MemoryArchiveEntry => e !== null)
  }

  /**
   * Count archived entries matching query (no data returned).
   */
  async count(opts: Partial<ColdMemoryQuery>): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabaseAdmin.from('learning_events') as any)
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'cold_archive')

    if (opts.org_id) q = q.eq('org_id', opts.org_id)
    if (opts.type) q = q.contains('metadata', { type: opts.type })
    if (opts.from) q = q.gte('created_at', opts.from)
    if (opts.to) q = q.lte('created_at', opts.to)

    const { count, error } = await q

    if (error) {
      logger.error('[ColdMemoryStore] Count query failed', { error, opts })
      return 0
    }

    return count ?? 0
  }

  /**
   * Delete archived entries by their IDs.
   * Returns the number of deleted entries.
   */
  async delete(entry_ids: string[]): Promise<number> {
    if (entry_ids.length === 0) return 0

    let deleted = 0

    // Delete in batches of 50
    for (let i = 0; i < entry_ids.length; i += 50) {
      const batch = entry_ids.slice(i, i + 50)

      for (const archive_id of batch) {
        const { error } = await supabaseAdmin
          .from('learning_events')
          .delete()
          .eq('event_type', 'cold_archive')
          .contains('metadata', { archive_id })

        if (!error) deleted++
      }
    }

    logger.info('[ColdMemoryStore] Entries deleted', { count: deleted })
    return deleted
  }

  /**
   * Get retention statistics for an org.
   */
  async getRetentionStats(org_id: string): Promise<RetentionStats> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin.from('learning_events') as any)
      .select('metadata, created_at')
      .eq('event_type', 'cold_archive')
      .eq('org_id', org_id)
      .order('created_at', { ascending: true })

    if (error || !data || data.length === 0) {
      return {
        org_id,
        total_entries: 0,
        oldest_entry: '',
        newest_entry: '',
        size_estimate_bytes: 0,
        by_type: {},
      }
    }

    const by_type: Record<string, number> = {}
    let size_estimate = 0

    for (const row of data) {
      const meta = row.metadata as Record<string, unknown>
      const type = (meta['type'] as string) ?? 'unknown'
      by_type[type] = (by_type[type] ?? 0) + 1
      size_estimate += JSON.stringify(meta).length
    }

    return {
      org_id,
      total_entries: data.length,
      oldest_entry: data[0].created_at as string,
      newest_entry: data[data.length - 1].created_at as string,
      size_estimate_bytes: size_estimate,
      by_type,
    }
  }
}

export const coldMemoryStore = new DBColdMemoryStore()
