// AGENCY GROUP — SH-ROS Queue: queueReplay | AMI: 22506
// Replay engine — idempotent, DB-backed, multi-strategy replay for failed/dlq events.

import { supabaseAdmin } from '@/lib/supabase'
import type { ReplayOptions } from './queueProvider'

// ─── ReplayResult ─────────────────────────────────────────────────────────────

export interface ReplayResult {
  replayed: number
  skipped: number
  errors: number
  duration_ms: number
  dry_run: boolean
  event_ids: string[]
}

// ─── Internal row shape ───────────────────────────────────────────────────────

interface EventStatusRow {
  event_id: string
  status: string
  retry_count: number
}

// ─── QueueReplayEngine ────────────────────────────────────────────────────────

export class QueueReplayEngine {

  // ── replayByOrg ────────────────────────────────────────────────────────────

  async replayByOrg(org_id: string, opts?: ReplayOptions): Promise<ReplayResult> {
    return this.executeReplay({ ...opts, org_id })
  }

  // ── replayByTraceId ────────────────────────────────────────────────────────

  async replayByTraceId(trace_id: string, org_id: string): Promise<ReplayResult> {
    return this.executeReplay({ trace_id, org_id })
  }

  // ── replayByEventChain ─────────────────────────────────────────────────────

  async replayByEventChain(event_chain: string[], org_id: string): Promise<ReplayResult> {
    return this.executeReplay({ event_chain, org_id })
  }

  // ── replayByTimeRange ──────────────────────────────────────────────────────

  async replayByTimeRange(from: string, to: string, org_id: string): Promise<ReplayResult> {
    return this.executeReplay({ from_timestamp: from, to_timestamp: to, org_id })
  }

  // ── dryRun ─────────────────────────────────────────────────────────────────

  async dryRun(opts: ReplayOptions): Promise<ReplayResult> {
    return this.executeReplay({ ...opts, dry_run: true })
  }

  // ── Core replay logic ──────────────────────────────────────────────────────

  private async executeReplay(opts: ReplayOptions): Promise<ReplayResult> {
    const start = Date.now()
    const result: ReplayResult = {
      replayed: 0,
      skipped: 0,
      errors: 0,
      duration_ms: 0,
      dry_run: opts.dry_run ?? false,
      event_ids: [],
    }

    try {
      // Build candidate query
      let q = supabaseAdmin
        .from('runtime_events')
        .select('event_id, status, retry_count')
        .in('status', ['failed', 'dlq'])

      if (opts.org_id) q = q.eq('org_id', opts.org_id)
      if (opts.from_timestamp) q = q.gte('timestamp', opts.from_timestamp)
      if (opts.to_timestamp) q = q.lte('timestamp', opts.to_timestamp)
      if (opts.event_types?.length) q = q.in('type', opts.event_types)
      if (opts.event_chain?.length) q = q.in('event_id', opts.event_chain)
      if (opts.trace_id) {
        q = q.eq('metadata->>trace_id', opts.trace_id)
      }
      if (opts.limit) q = q.limit(opts.limit)

      const { data, error } = await q
      if (error) throw error
      if (!data || data.length === 0) {
        result.duration_ms = Date.now() - start
        return result
      }

      const candidates = data as EventStatusRow[]

      if (opts.dry_run) {
        // No mutations — just count and list
        for (const row of candidates) {
          if (row.status === 'completed') {
            result.skipped++
          } else {
            result.replayed++
            result.event_ids.push(row.event_id)
          }
        }
        result.duration_ms = Date.now() - start
        return result
      }

      // Filter out already-completed (idempotency)
      const toReplay = candidates.filter((r) => r.status !== 'completed')
      const toSkip = candidates.filter((r) => r.status === 'completed')
      result.skipped = toSkip.length

      if (toReplay.length === 0) {
        result.duration_ms = Date.now() - start
        return result
      }

      const ids = toReplay.map((r) => r.event_id)

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('runtime_events')
        .update({
          status: 'pending',
          retry_count: 0,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .in('event_id', ids)
        .in('status', ['failed', 'dlq']) // guard: skip any that completed between fetch and update
        .select('event_id')

      if (updateErr) throw updateErr

      const replayedIds = (updated as { event_id: string }[] | null)?.map((r) => r.event_id) ?? []
      result.replayed = replayedIds.length
      result.event_ids = replayedIds
      result.skipped += toReplay.length - replayedIds.length // raced to completed

    } catch (err) {
      console.error('[QueueReplayEngine] executeReplay error:', err)
      result.errors++
    }

    result.duration_ms = Date.now() - start
    return result
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const queueReplayEngine = new QueueReplayEngine()
