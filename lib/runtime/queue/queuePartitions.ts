// AGENCY GROUP — SH-ROS Queue: queuePartitions | AMI: 22506
// Partition management — deterministic org-to-partition assignment via hash.

import { supabaseAdmin } from '@/lib/supabase'
import type { RuntimeEvent } from '@/lib/runtime/types'

// ─── QueuePartitionManager ────────────────────────────────────────────────────

export class QueuePartitionManager {
  private readonly partitionCount: number

  constructor() {
    const fromEnv = parseInt(process.env.QUEUE_PARTITION_COUNT ?? '4', 10)
    this.partitionCount = isNaN(fromEnv) || fromEnv < 1 ? 4 : fromEnv
  }

  // ── getPartitionKey ────────────────────────────────────────────────────────

  getPartitionKey(event: RuntimeEvent): string {
    return `partition-${this.assignPartition(event.org_id)}`
  }

  // ── getPartitionCount ──────────────────────────────────────────────────────

  getPartitionCount(): number {
    return this.partitionCount
  }

  // ── assignPartition ────────────────────────────────────────────────────────
  // Deterministic: same org_id always maps to the same partition.

  assignPartition(org_id: string): number {
    return Math.abs(this.djb2Hash(org_id)) % this.partitionCount
  }

  // ── getPartitionStats ──────────────────────────────────────────────────────

  async getPartitionStats(): Promise<Record<number, { lag: number; throughput: number }>> {
    const stats: Record<number, { lag: number; throughput: number }> = {}

    for (let i = 0; i < this.partitionCount; i++) {
      stats[i] = { lag: 0, throughput: 0 }
    }

    try {
      // Pull pending counts from runtime_events, group by org to derive partition
      const { data, error } = await supabaseAdmin
        .from('runtime_events')
        .select('org_id, status')
        .in('status', ['pending', 'processing'])

      if (error) throw error
      if (!data) return stats

      const oneMinAgo = new Date(Date.now() - 60_000).toISOString()

      const { data: throughputData, error: tpErr } = await supabaseAdmin
        .from('runtime_events')
        .select('org_id')
        .eq('status', 'completed')
        .gte('updated_at', oneMinAgo)

      if (tpErr) throw tpErr

      for (const row of data as { org_id: string; status: string }[]) {
        const p = this.assignPartition(row.org_id)
        stats[p] ??= { lag: 0, throughput: 0 }
        stats[p].lag++
      }

      for (const row of (throughputData ?? []) as { org_id: string }[]) {
        const p = this.assignPartition(row.org_id)
        stats[p] ??= { lag: 0, throughput: 0 }
        stats[p].throughput++
      }
    } catch (err) {
      console.error('[QueuePartitionManager] getPartitionStats error:', err)
    }

    return stats
  }

  // ── DJB2 hash ──────────────────────────────────────────────────────────────

  private djb2Hash(str: string): number {
    let hash = 5381
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i)
    }
    return hash >>> 0 // unsigned 32-bit
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const queuePartitionManager = new QueuePartitionManager()
