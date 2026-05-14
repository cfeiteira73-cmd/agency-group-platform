// AGENCY GROUP — SH-ROS Recovery: recoveryEngine | AMI: 22506
// Master recovery coordinator — orchestrates all sub-recovery systems.
// Produces auditable RecoveryReport; writes to learning_events for full traceability.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { OrphanRecovery } from './orphanRecovery'
import { RecoverySnapshotStore } from './recoverySnapshots'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecoveryReport {
  run_id: string
  org_id?: string
  started_at: string
  completed_at: string
  orphans_recovered: number
  dlq_recovered: number
  stuck_recovered: number
  errors: string[]
  economic_impact_eur: number
}

// ─── RecoveryEngine ───────────────────────────────────────────────────────────

export class RecoveryEngine {
  private readonly orphanRecovery = new OrphanRecovery()
  private readonly snapshotStore = new RecoverySnapshotStore()

  /**
   * Full recovery pass: orphans → DLQ → stuck processing.
   * Saves pre/post snapshots and writes a recovery_run learning event.
   */
  async runFullRecovery(org_id?: string): Promise<RecoveryReport> {
    const run_id = randomUUID()
    const started_at = new Date().toISOString()
    const errors: string[] = []

    // Pre-recovery snapshot
    try {
      await this.snapshotStore.save({
        snapshot_id: randomUUID(),
        org_id,
        type: 'pre_recovery',
        event_count: 0,
        status_distribution: await this._getStatusDistribution(org_id),
        created_at: new Date().toISOString(),
        metadata: { run_id },
      })
    } catch (err) {
      errors.push(`pre_snapshot: ${String(err)}`)
    }

    let orphans_recovered = 0
    let dlq_recovered = 0
    let stuck_recovered = 0

    // 1. Recover orphans (processing > 5 min)
    try {
      orphans_recovered = await this.recoverOrphans(org_id)
    } catch (err) {
      errors.push(`orphan_recovery: ${String(err)}`)
      console.warn('[RecoveryEngine] orphan_recovery failed:', err)
    }

    // 2. Recover DLQ — reset retryable DLQ items to pending
    try {
      dlq_recovered = await this.recoverDLQ(org_id)
    } catch (err) {
      errors.push(`dlq_recovery: ${String(err)}`)
      console.warn('[RecoveryEngine] dlq_recovery failed:', err)
    }

    // 3. Recover stuck processing (threshold 10 min for full run)
    try {
      stuck_recovered = await this.recoverStuckProcessing(org_id, 10 * 60 * 1000)
    } catch (err) {
      errors.push(`stuck_recovery: ${String(err)}`)
      console.warn('[RecoveryEngine] stuck_recovery failed:', err)
    }

    const completed_at = new Date().toISOString()

    // Post-recovery snapshot
    try {
      await this.snapshotStore.save({
        snapshot_id: randomUUID(),
        org_id,
        type: 'post_recovery',
        event_count: orphans_recovered + dlq_recovered + stuck_recovered,
        status_distribution: await this._getStatusDistribution(org_id),
        created_at: completed_at,
        metadata: { run_id, orphans_recovered, dlq_recovered, stuck_recovered },
      })
    } catch (err) {
      errors.push(`post_snapshot: ${String(err)}`)
    }

    const report: RecoveryReport = {
      run_id,
      org_id,
      started_at,
      completed_at,
      orphans_recovered,
      dlq_recovered,
      stuck_recovered,
      errors,
      economic_impact_eur: 0, // placeholder — no revenue impact on infra recovery
    }

    // Persist to learning_events for audit trail
    try {
      await supabaseAdmin.from('learning_events').insert({
        event_type: 'recovery_run',
        agent_email: 'system:recovery-engine',
        metadata: report as unknown as Record<string, unknown>,
      })
    } catch (err) {
      console.warn('[RecoveryEngine] failed to write recovery_run event:', err)
    }

    return report
  }

  /**
   * Detect and reset orphaned events (stuck in 'processing' beyond threshold).
   * Returns count of events successfully recovered.
   */
  async recoverOrphans(org_id?: string, threshold_ms = 5 * 60 * 1000): Promise<number> {
    const actions = await this.orphanRecovery.recoverAll(org_id, threshold_ms)
    return actions.filter((a) => a.success).length
  }

  /**
   * Reset DLQ events that are retryable (retry_count < MAX_RETRIES) back to pending.
   * Events with retry_count >= 3 are left in DLQ.
   */
  async recoverDLQ(org_id?: string): Promise<number> {
    try {
      let query = supabaseAdmin
        .from('runtime_events')
        .select('event_id, retry_count')
        .eq('status', 'dlq')
        .lt('retry_count', 3)

      if (org_id) query = query.eq('org_id', org_id)

      const { data, error } = await query
      if (error) throw error
      if (!data || data.length === 0) return 0

      const ids = data.map((r) => r.event_id)

      const { error: updateError } = await supabaseAdmin
        .from('runtime_events')
        .update({
          status: 'pending',
          updated_at: new Date().toISOString(),
          error_message: null,
        } as Record<string, unknown>)
        .in('event_id', ids)

      if (updateError) throw updateError
      return ids.length
    } catch (err) {
      console.warn('[RecoveryEngine] recoverDLQ error:', err)
      return 0
    }
  }

  /**
   * Reset events stuck in 'processing' beyond threshold_ms back to pending.
   * Separate from orphanRecovery — uses a different (longer) threshold.
   */
  async recoverStuckProcessing(org_id?: string, threshold_ms = 10 * 60 * 1000): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - threshold_ms).toISOString()

      let query = supabaseAdmin
        .from('runtime_events')
        .select('event_id')
        .eq('status', 'processing')
        .lt('updated_at', cutoff)

      if (org_id) query = query.eq('org_id', org_id)

      const { data, error } = await query
      if (error) throw error
      if (!data || data.length === 0) return 0

      const ids = data.map((r) => r.event_id)

      const { error: updateError } = await supabaseAdmin
        .from('runtime_events')
        .update({
          status: 'pending',
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .in('event_id', ids)

      if (updateError) throw updateError
      return ids.length
    } catch (err) {
      console.warn('[RecoveryEngine] recoverStuckProcessing error:', err)
      return 0
    }
  }

  /**
   * Retrieve historical recovery reports for an org.
   */
  async getRecoveryHistory(org_id: string, limit = 20): Promise<RecoveryReport[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('learning_events')
        .select('metadata, created_at')
        .eq('event_type', 'recovery_run')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      if (!data) return []

      return data
        .map((row) => row.metadata as unknown as RecoveryReport)
        .filter((r) => !org_id || r.org_id === org_id)
    } catch (err) {
      console.warn('[RecoveryEngine] getRecoveryHistory error:', err)
      return []
    }
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private async _getStatusDistribution(org_id?: string): Promise<Record<string, number>> {
    try {
      let query = supabaseAdmin
        .from('runtime_events')
        .select('status')

      if (org_id) query = query.eq('org_id', org_id)

      const { data, error } = await query
      if (error) throw error

      const dist: Record<string, number> = {}
      for (const row of data ?? []) {
        const s = (row as Record<string, unknown>).status as string
        dist[s] = (dist[s] ?? 0) + 1
      }
      return dist
    } catch {
      return {}
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const recoveryEngine = new RecoveryEngine()
