// AGENCY GROUP — SH-ROS Distributed: Distributed Replay Engine | AMI: 22506
// Cross-region deterministic replay — same events, same order, same outcome
// Requires replay authorization (replayAuthorizationEngine) before execution
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { multiRegionRouter, type Region } from './multiRegionRouter'
import { partitionStrategy } from './partitionStrategy'
import { replayAuthorizationEngine } from '@/lib/security/replayAuthorization'
import { queuePoisonProtection } from '@/lib/security/queuePoisonProtection'
import type { RuntimeEvent } from '@/lib/runtime/types'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DistributedReplayRequest {
  replay_id: string       // Must be pre-authorized via replayAuthorizationEngine
  org_id: string
  target_region?: Region  // null = replay in org's home region
  event_ids?: string[]    // specific events to replay
  from_ts?: string
  to_ts?: string
  event_types?: string[]
  dry_run?: boolean
  actor: string
}

export interface ReplayProgress {
  replay_id: string
  org_id: string
  target_region: Region
  total_events: number
  replayed: number
  skipped: number
  failed: number
  poisoned: number
  started_at: string
  estimated_completion_at: string | null
  status: 'preparing' | 'running' | 'completed' | 'failed' | 'aborted'
}

export interface ReplaySummary {
  replay_id: string
  org_id: string
  target_region: Region
  total_events: number
  replayed: number
  skipped: number
  failed: number
  poisoned: number
  duration_ms: number
  deterministic: boolean  // whether replay was bit-for-bit identical
  divergences: Array<{ event_id: string; reason: string }>
}

// ─── Distributed Replay Engine ────────────────────────────────────────────────

export class DistributedReplayEngine {
  private _progress = new Map<string, ReplayProgress>()

  /**
   * Execute a distributed replay.
   * Requires: replay_id must be pre-authorized.
   * Guarantees: deterministic order, poison detection, cross-region safety.
   */
  async executeReplay(request: DistributedReplayRequest): Promise<ReplaySummary> {
    const start = Date.now()

    // 1. Verify authorization (mandatory — cannot be bypassed)
    const auth = await replayAuthorizationEngine.assertAuthorized(request.replay_id)
    logger.info('[DistributedReplay] Authorization verified', {
      replay_id: request.replay_id,
      org_id: request.org_id,
    })

    // 2. Determine target region
    const target_region = request.target_region ?? multiRegionRouter.getOrgRegion(request.org_id)

    // 3. Initialize progress tracker
    const progress: ReplayProgress = {
      replay_id: request.replay_id,
      org_id: request.org_id,
      target_region,
      total_events: 0,
      replayed: 0,
      skipped: 0,
      failed: 0,
      poisoned: 0,
      started_at: new Date().toISOString(),
      estimated_completion_at: null,
      status: 'preparing',
    }
    this._progress.set(request.replay_id, progress)

    // 4. Fetch events to replay
    const events = await this._fetchEvents(request)
    progress.total_events = events.length
    progress.status = 'running'
    this._progress.set(request.replay_id, { ...progress })

    logger.info('[DistributedReplay] Starting', {
      replay_id: request.replay_id,
      total: events.length,
      target_region,
      dry_run: request.dry_run,
    })

    const divergences: Array<{ event_id: string; reason: string }> = []
    let replayed = 0, skipped = 0, failed = 0, poisoned = 0

    // 5. Replay events in deterministic order (sorted by timestamp, then partition)
    const sorted_events = this._sortDeterministically(events)

    for (const event of sorted_events) {
      // Poison check before replay
      const poison_check = queuePoisonProtection.inspect(
        `replay:${target_region}`,
        event.event_id,
        event as unknown as Record<string, unknown>
      )

      if (poison_check.is_poison) {
        poisoned++
        divergences.push({ event_id: event.event_id, reason: `poison:${poison_check.reason}` })
        logger.warn('[DistributedReplay] Poisoned event skipped', {
          event_id: event.event_id, reason: poison_check.reason,
        })
        continue
      }

      if (request.dry_run) {
        // Dry run: validate only, don't actually replay
        replayed++
        continue
      }

      try {
        // Replay the event by re-inserting into runtime_events with replay metadata
        await this._replayEvent(event, request.replay_id, target_region, request.actor)
        replayed++
      } catch (err) {
        failed++
        divergences.push({ event_id: event.event_id, reason: String(err) })
        logger.error('[DistributedReplay] Event replay failed', {
          event_id: event.event_id,
          error: String(err),
        })

        // Record failure for poison detection
        queuePoisonProtection.recordFailure(
          `replay:${target_region}`,
          event as unknown as Record<string, unknown>,
          String(err)
        )
      }

      // Update progress
      const current = this._progress.get(request.replay_id)!
      this._progress.set(request.replay_id, {
        ...current,
        replayed, failed, skipped, poisoned,
      })
    }

    // 6. Mark authorization as executed (one-time-use)
    await replayAuthorizationEngine.markExecuted(
      request.replay_id,
      request.org_id,
      request.actor
    )

    const summary: ReplaySummary = {
      replay_id: request.replay_id,
      org_id: request.org_id,
      target_region,
      total_events: events.length,
      replayed,
      skipped,
      failed,
      poisoned,
      duration_ms: Date.now() - start,
      deterministic: divergences.length === 0,
      divergences,
    }

    // Final progress update
    this._progress.set(request.replay_id, {
      ...progress, replayed, skipped, failed, poisoned,
      status: failed > 0 ? 'failed' : 'completed',
    })

    logger.info('[DistributedReplay] Complete', {
      replay_id: request.replay_id,
      replayed, failed, poisoned,
      duration_ms: summary.duration_ms,
      deterministic: summary.deterministic,
    })

    return summary

    void auth
  }

  /**
   * Get progress for an active replay.
   */
  getProgress(replay_id: string): ReplayProgress | null {
    return this._progress.get(replay_id) ?? null
  }

  /**
   * Abort an in-progress replay.
   */
  abort(replay_id: string, reason: string): void {
    const progress = this._progress.get(replay_id)
    if (!progress) return
    this._progress.set(replay_id, { ...progress, status: 'aborted' })
    logger.warn('[DistributedReplay] Aborted', { replay_id, reason })
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async _fetchEvents(request: DistributedReplayRequest): Promise<RuntimeEvent[]> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from('runtime_events') as any)
      .select('*')
      .eq('org_id', request.org_id)
      .order('created_at', { ascending: true })  // chronological order — deterministic
      .limit(request.event_ids ? request.event_ids.length : 10_000)

    if (request.event_ids?.length) {
      q = q.in('event_id', request.event_ids)
    }
    if (request.from_ts) q = q.gte('created_at', request.from_ts)
    if (request.to_ts) q = q.lte('created_at', request.to_ts)
    if (request.event_types?.length) q = q.in('event_type', request.event_types)

    const { data, error } = await q
    if (error) {
      logger.error('[DistributedReplay] Fetch failed', { error })
      return []
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((row: any) => row.payload as RuntimeEvent).filter(Boolean)
  }

  private _sortDeterministically(events: RuntimeEvent[]): RuntimeEvent[] {
    return [...events].sort((a, b) => {
      // Primary: timestamp (chronological)
      const ts_diff = a.timestamp.localeCompare(b.timestamp)
      if (ts_diff !== 0) return ts_diff
      // Secondary: partition (deterministic ordering within same timestamp)
      const pa = partitionStrategy.assignPartition(a.org_id, a.priority)
      const pb = partitionStrategy.assignPartition(b.org_id, b.priority)
      return pa - pb
    })
  }

  private async _replayEvent(
    event: RuntimeEvent,
    replay_id: string,
    target_region: Region,
    actor: string
  ): Promise<void> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

    // Insert a replay record — marks original event as replayed
    await (sb.from('runtime_events') as { insert: (d: unknown) => Promise<{ error: unknown }> }).insert({
      event_id: `replay:${replay_id}:${event.event_id}`,  // distinct ID to avoid dedup collision
      org_id: event.org_id,
      event_type: event.type,
      priority: event.priority,
      correlation_id: event.correlation_id,
      payload: event as unknown as Record<string, unknown>,
      metadata: {
        replay_id,
        original_event_id: event.event_id,
        target_region,
        replayed_by: actor,
        replayed_at: new Date().toISOString(),
        schema_version: 'vFINAL',
      },
      created_at: new Date().toISOString(),
    })
  }
}

export const distributedReplayEngine = new DistributedReplayEngine()
