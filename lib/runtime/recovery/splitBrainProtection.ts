// AGENCY GROUP — SH-ROS Recovery: splitBrainProtection | AMI: 22506
// Split-brain detection — catches edge cases where the same logical event
// was processed by multiple workers (correlation_id divergence, dual writes).
// Resolution policy: latest_wins for status conflicts; manual for data conflicts.

import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SplitBrainStatus {
  detected: boolean
  conflicts: SplitBrainConflict[]
  checked_at: string
}

export interface SplitBrainConflict {
  event_id: string
  org_id: string
  conflicting_statuses: string[]
  last_writer: string
  resolution: 'latest_wins' | 'manual_required'
}

// Status transitions that cannot safely be auto-resolved
const MANUAL_REQUIRED_STATUS_PAIRS: ReadonlySet<string> = new Set([
  'completed:completed', // double completion
  'failed:completed',    // one worker failed, another completed — ambiguous
  'completed:failed',
])

// ─── SplitBrainProtector ──────────────────────────────────────────────────────

export class SplitBrainProtector {
  /**
   * Check for split-brain conditions across runtime_events for an org.
   * Primary detection: events in automations_log with duplicate event_id references.
   * Secondary detection: system_alerts flagging concurrent processing.
   */
  async checkForSplitBrain(org_id?: string): Promise<SplitBrainStatus> {
    const checked_at = new Date().toISOString()
    const conflicts: SplitBrainConflict[] = []

    try {
      // Strategy: check automations_log for same event_id executed multiple times
      // (multiple workers claiming and completing the same event)
      const logConflicts = await this._detectFromAutomationsLog(org_id)
      conflicts.push(...logConflicts)

      // Also check for same correlation_id with mismatched final statuses
      const correlationConflicts = await this._detectCorrelationMismatch(org_id)
      conflicts.push(...correlationConflicts)
    } catch (err) {
      console.warn('[SplitBrainProtector] checkForSplitBrain error:', err)
    }

    return {
      detected: conflicts.length > 0,
      conflicts,
      checked_at,
    }
  }

  /**
   * Resolve a split-brain conflict.
   * latest_wins: keep the most recent status, mark others as superseded.
   * manual_required: log to system_alerts for human review.
   */
  async resolveConflict(conflict: SplitBrainConflict): Promise<void> {
    try {
      if (conflict.resolution === 'manual_required') {
        // Escalate to system_alerts for operator review
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin as any).from('system_alerts').insert({
          alert_type: 'split_brain_conflict',
          severity: 'high',
          org_id: conflict.org_id,
          title: `Split-brain conflict on event ${conflict.event_id}`,
          message: `Conflicting statuses detected: ${conflict.conflicting_statuses.join(' vs ')}. Manual resolution required.`,
          metadata: conflict as unknown as Record<string, unknown>,
          status: 'open',
        })
        return
      }

      // latest_wins: the last_writer's status is authoritative
      // Log the resolution to learning_events
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin.from('learning_events') as any).insert({
        event_type: 'split_brain_resolved',
        agent_email: 'system:split-brain-protector',
        metadata: {
          ...conflict,
          resolved_at: new Date().toISOString(),
          resolution_strategy: 'latest_wins',
        },
      })
    } catch (err) {
      console.warn('[SplitBrainProtector] resolveConflict error:', err)
    }
  }

  // ─── Private detectors ─────────────────────────────────────────────────────

  /**
   * Check automations_log for duplicate event_id processing.
   * If the same event_id appears multiple times with different statuses → split-brain.
   */
  private async _detectFromAutomationsLog(org_id?: string): Promise<SplitBrainConflict[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabaseAdmin as any
      let query = sb
        .from('automations_log')
        .select('event_id, status, created_at, metadata')
        .not('event_id', 'is', null)
        .order('created_at', { ascending: false })

      if (org_id) query = query.eq('org_id', org_id)

      const { data, error } = await query
      if (error) throw error

      // Group by event_id
      const byEvent = new Map<string, Array<Record<string, unknown>>>()
      for (const row of data ?? []) {
        const r = row as Record<string, unknown>
        const eid = r.event_id as string
        if (!eid) continue
        if (!byEvent.has(eid)) byEvent.set(eid, [])
        byEvent.get(eid)!.push(r)
      }

      const conflicts: SplitBrainConflict[] = []

      for (const [event_id, rows] of byEvent) {
        if (rows.length < 2) continue

        const statuses = [...new Set(rows.map((r) => r.status as string))]
        if (statuses.length < 2) continue // same status, not a conflict

        const statusPair = statuses.sort().join(':')
        const resolution = MANUAL_REQUIRED_STATUS_PAIRS.has(statusPair)
          ? 'manual_required'
          : 'latest_wins'

        // last_writer = the most recent log entry's metadata.worker_id
        const latest = rows[0]
        const meta = (latest.metadata as Record<string, unknown>) ?? {}
        const last_writer = (meta.worker_id as string) ?? (meta.agent_id as string) ?? 'unknown'

        // Get org_id from first row
        const rowOrgId = (rows[0].org_id as string) ?? org_id ?? 'unknown'

        conflicts.push({ event_id, org_id: rowOrgId, conflicting_statuses: statuses, last_writer, resolution })
      }

      return conflicts
    } catch (err) {
      console.warn('[SplitBrainProtector] _detectFromAutomationsLog error:', err)
      return []
    }
  }

  /**
   * Detect events with the same correlation_id but contradictory final statuses
   * across different event_ids (worker A and worker B both completed different
   * events with the same correlation, indicating branching).
   */
  private async _detectCorrelationMismatch(org_id?: string): Promise<SplitBrainConflict[]> {
    try {
      let query = supabaseAdmin
        .from('runtime_events')
        .select('event_id, org_id, correlation_id, status, updated_at')
        .in('status', ['completed', 'failed'])
        .not('correlation_id', 'is', null)

      if (org_id) query = query.eq('org_id', org_id)

      const { data, error } = await query
      if (error) throw error

      const byCorrelation = new Map<string, Array<Record<string, unknown>>>()
      for (const row of data ?? []) {
        const r = row as Record<string, unknown>
        const cid = r.correlation_id as string
        if (!byCorrelation.has(cid)) byCorrelation.set(cid, [])
        byCorrelation.get(cid)!.push(r)
      }

      const conflicts: SplitBrainConflict[] = []

      for (const [, events] of byCorrelation) {
        if (events.length < 2) continue

        const statuses = [...new Set(events.map((e) => e.status as string))]
        if (statuses.length < 2) continue

        const statusPair = statuses.sort().join(':')
        const resolution = MANUAL_REQUIRED_STATUS_PAIRS.has(statusPair)
          ? 'manual_required'
          : 'latest_wins'

        // Sort by updated_at desc — latest is authoritative
        const sorted = [...events].sort(
          (a, b) =>
            new Date(b.updated_at as string).getTime() -
            new Date(a.updated_at as string).getTime()
        )

        const latest = sorted[0]
        conflicts.push({
          event_id: latest.event_id as string,
          org_id: (latest.org_id as string) ?? org_id ?? 'unknown',
          conflicting_statuses: statuses,
          last_writer: `event:${latest.event_id}`,
          resolution,
        })
      }

      return conflicts
    } catch (err) {
      console.warn('[SplitBrainProtector] _detectCorrelationMismatch error:', err)
      return []
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const splitBrainProtector = new SplitBrainProtector()
