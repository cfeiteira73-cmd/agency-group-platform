// AGENCY GROUP — SH-ROS Queue: queueDeadLetter | AMI: 22506
// DLQ management backed by runtime_events table (status='dlq').

import { supabaseAdmin } from '@/lib/supabase'
import type { RuntimeEvent } from '@/lib/runtime/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

// ─── DLQEntry ─────────────────────────────────────────────────────────────────

export interface DLQEntry {
  event_id: string
  org_id: string
  type: string
  reason: string
  failed_at: string
  retry_count: number
  agent_id?: string
  original_payload: Record<string, unknown>
}

// ─── Internal row ─────────────────────────────────────────────────────────────

interface DLQRow {
  event_id: string
  org_id: string
  type: string
  last_error: string | null
  updated_at: string
  retry_count: number
  agent_id: string | null
  payload: Record<string, unknown>
}

function rowToDLQEntry(row: DLQRow): DLQEntry {
  return {
    event_id: row.event_id,
    org_id: row.org_id,
    type: row.type,
    reason: row.last_error ?? 'unknown',
    failed_at: row.updated_at,
    retry_count: row.retry_count,
    agent_id: row.agent_id ?? undefined,
    original_payload: row.payload,
  }
}

// ─── DeadLetterQueue ──────────────────────────────────────────────────────────

export class DeadLetterQueue {

  // ── add ────────────────────────────────────────────────────────────────────

  async add(event: RuntimeEvent, reason: string, agent_id?: string): Promise<void> {
    try {
      const { error } = await sb
        .from('runtime_events')
        .upsert({
          event_id: event.event_id,
          org_id: event.org_id,
          type: event.type,
          timestamp: event.timestamp,
          correlation_id: event.correlation_id,
          priority: event.priority,
          priority_weight: priorityWeight(event.priority),
          retry_count: event.retry_count,
          payload: event.payload,
          metadata: event.metadata,
          status: 'dlq',
          last_error: reason,
          agent_id: agent_id ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'event_id' })

      if (error) throw error
    } catch (err) {
      console.error('[DeadLetterQueue] add error:', err)
      throw err
    }
  }

  // ── list ───────────────────────────────────────────────────────────────────

  async list(org_id: string, limit = 50): Promise<DLQEntry[]> {
    try {
      const { data, error } = await sb
        .from('runtime_events')
        .select('event_id, org_id, type, last_error, updated_at, retry_count, agent_id, payload')
        .eq('org_id', org_id)
        .eq('status', 'dlq')
        .order('updated_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      if (!data) return []

      return (data as unknown as DLQRow[]).map(rowToDLQEntry)
    } catch (err) {
      console.error('[DeadLetterQueue] list error:', err)
      return []
    }
  }

  // ── replay ─────────────────────────────────────────────────────────────────

  async replay(org_id: string, event_ids?: string[]): Promise<number> {
    try {
      let q = sb
        .from('runtime_events')
        .update({
          status: 'pending',
          retry_count: 0,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', org_id)
        .eq('status', 'dlq')

      if (event_ids?.length) {
        q = q.in('event_id', event_ids)
      }

      const { data, error } = await q.select('event_id')
      if (error) throw error

      return (data as { event_id: string }[] | null)?.length ?? 0
    } catch (err) {
      console.error('[DeadLetterQueue] replay error:', err)
      return 0
    }
  }

  // ── purge ──────────────────────────────────────────────────────────────────

  async purge(org_id: string, older_than_days = 30): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - older_than_days * 86_400_000).toISOString()

      const { data, error } = await sb
        .from('runtime_events')
        .delete()
        .eq('org_id', org_id)
        .eq('status', 'dlq')
        .lt('updated_at', cutoff)
        .select('event_id')

      if (error) throw error
      return (data as { event_id: string }[] | null)?.length ?? 0
    } catch (err) {
      console.error('[DeadLetterQueue] purge error:', err)
      return 0
    }
  }

  // ── inspect ────────────────────────────────────────────────────────────────

  async inspect(event_id: string): Promise<DLQEntry | null> {
    try {
      const { data, error } = await sb
        .from('runtime_events')
        .select('event_id, org_id, type, last_error, updated_at, retry_count, agent_id, payload')
        .eq('event_id', event_id)
        .eq('status', 'dlq')
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // not found
        throw error
      }

      return data ? rowToDLQEntry(data as unknown as DLQRow) : null
    } catch (err) {
      console.error('[DeadLetterQueue] inspect error:', err)
      return null
    }
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function priorityWeight(p: string): number {
  const map: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  return map[p] ?? 1
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const deadLetterQueue = new DeadLetterQueue()
