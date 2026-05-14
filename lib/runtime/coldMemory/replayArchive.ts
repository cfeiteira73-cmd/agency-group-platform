// AGENCY GROUP — SH-ROS coldMemory: replayArchive | AMI: 22506
// Immutable replay archive — event + trace stored for forensic replay
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'
import type { RuntimeEvent } from '@/lib/runtime/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReplayArchiveEntry {
  event_id: string
  org_id: string
  event: RuntimeEvent
  trace: Record<string, unknown>
  stored_at: string
  replayable: boolean
}

// ─── Archive ─────────────────────────────────────────────────────────────────

export class ReplayArchive {
  /**
   * Store an event and its execution trace in the immutable replay archive.
   * Stored in learning_events with event_type='replay_archive'.
   * Idempotent: if event_id already exists for org_id, no-op.
   */
  async store(event: RuntimeEvent, trace: Record<string, unknown>): Promise<void> {
    const stored_at = new Date().toISOString()

    // Check idempotency
    const existing = await this.fetch(event.event_id, event.org_id)
    if (existing) {
      logger.info('[ReplayArchive] Event already archived, skipping', {
        event_id: event.event_id,
        org_id: event.org_id,
      })
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin.from('learning_events') as any).insert({
      event_type: 'replay_archive',
      org_id: event.org_id,
      metadata: {
        event_id: event.event_id,
        event,
        trace,
        stored_at,
        replayable: true,
      },
      created_at: stored_at,
    })

    if (error) {
      logger.error('[ReplayArchive] Failed to store event', {
        error,
        event_id: event.event_id,
        org_id: event.org_id,
      })
      throw new Error(`Replay archive store failed: ${error.message}`)
    }

    logger.info('[ReplayArchive] Event stored', {
      event_id: event.event_id,
      type: event.type,
      org_id: event.org_id,
    })
  }

  /**
   * Fetch a single archived event by event_id and org_id.
   */
  async fetch(event_id: string, org_id: string): Promise<ReplayArchiveEntry | null> {
    const { data, error } = await sb
      .from('learning_events')
      .select('metadata, created_at')
      .eq('event_type', 'replay_archive')
      .eq('org_id', org_id)
      .contains('metadata', { event_id })
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return null
    }

    return this._rowToEntry(data.metadata as Record<string, unknown>)
  }

  /**
   * Fetch all archived events belonging to a trace.
   */
  async fetchByTraceId(trace_id: string, org_id: string): Promise<ReplayArchiveEntry[]> {
    const { data, error } = await sb
      .from('learning_events')
      .select('metadata, created_at')
      .eq('event_type', 'replay_archive')
      .eq('org_id', org_id)
      .order('created_at', { ascending: true })

    if (error || !data) {
      return []
    }

    return data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((row: any) => {
        const meta = row.metadata as Record<string, unknown>
        const event = meta['event'] as Record<string, unknown>
        const traceInMeta = (meta['trace'] as Record<string, unknown>) ?? {}
        if (
          (event?.['metadata'] as Record<string, unknown>)?.['trace_id'] !== trace_id &&
          traceInMeta['trace_id'] !== trace_id
        ) {
          return null
        }
        return this._rowToEntry(meta)
      })
      .filter((e: ReplayArchiveEntry | null): e is ReplayArchiveEntry => e !== null)
  }

  /**
   * Fetch all archived events that are part of a given event chain.
   */
  async fetchByChain(event_chain: string[], org_id: string): Promise<ReplayArchiveEntry[]> {
    if (event_chain.length === 0) return []

    const results: ReplayArchiveEntry[] = []

    for (const event_id of event_chain) {
      const entry = await this.fetch(event_id, org_id)
      if (entry) {
        results.push(entry)
      }
    }

    return results.sort((a, b) =>
      a.stored_at < b.stored_at ? -1 : a.stored_at > b.stored_at ? 1 : 0
    )
  }

  /**
   * Mark an event as no longer replayable (e.g. after a side-effect that can't be undone).
   */
  async markNonReplayable(event_id: string, org_id: string, reason: string): Promise<void> {
    const { data } = await sb
      .from('learning_events')
      .select('metadata')
      .eq('event_type', 'replay_archive')
      .eq('org_id', org_id)
      .contains('metadata', { event_id })
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!data) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (data as any).metadata as Record<string, unknown>
    await sb
      .from('learning_events')
      .update({
        metadata: { ...meta, replayable: false, non_replayable_reason: reason },
      })
      .eq('event_type', 'replay_archive')
      .eq('org_id', org_id)
      .contains('metadata', { event_id })

    logger.info('[ReplayArchive] Event marked non-replayable', { event_id, reason })
  }

  private _rowToEntry(meta: Record<string, unknown>): ReplayArchiveEntry {
    return {
      event_id: meta['event_id'] as string,
      org_id: (meta['event'] as Record<string, unknown>)?.['org_id'] as string,
      event: meta['event'] as RuntimeEvent,
      trace: (meta['trace'] as Record<string, unknown>) ?? {},
      stored_at: meta['stored_at'] as string,
      replayable: meta['replayable'] !== false,
    }
  }
}

export const replayArchive = new ReplayArchive()
