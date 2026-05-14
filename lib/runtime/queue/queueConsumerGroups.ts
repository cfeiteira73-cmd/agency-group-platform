// AGENCY GROUP — SH-ROS Queue: queueConsumerGroups | AMI: 22506
// Consumer group management — in-process registry with partition rebalancing.

import { supabaseAdmin } from '@/lib/supabase'
import { queuePartitionManager } from './queuePartitions'

// ─── ConsumerGroupManager ─────────────────────────────────────────────────────

export class ConsumerGroupManager {
  /** group_id → Set<worker_id> */
  private readonly groups = new Map<string, Set<string>>()
  /** group_id → partition assignment map (worker_id → partition[]) */
  private readonly assignments = new Map<string, Map<string, number[]>>()

  // ── register ───────────────────────────────────────────────────────────────

  register(group_id: string, worker_id: string): void {
    if (!this.groups.has(group_id)) {
      this.groups.set(group_id, new Set())
    }
    this.groups.get(group_id)!.add(worker_id)
    this.rebalance(group_id)
  }

  // ── unregister ─────────────────────────────────────────────────────────────

  unregister(group_id: string, worker_id: string): void {
    const workers = this.groups.get(group_id)
    if (workers) {
      workers.delete(worker_id)
      if (workers.size === 0) {
        this.groups.delete(group_id)
        this.assignments.delete(group_id)
      } else {
        this.rebalance(group_id)
      }
    }
  }

  // ── getActiveWorkers ───────────────────────────────────────────────────────

  getActiveWorkers(group_id: string): string[] {
    return Array.from(this.groups.get(group_id) ?? [])
  }

  // ── rebalance ──────────────────────────────────────────────────────────────
  // Distributes partitions evenly across workers (round-robin).

  rebalance(group_id: string): void {
    const workers = Array.from(this.groups.get(group_id) ?? [])
    if (workers.length === 0) {
      this.assignments.delete(group_id)
      return
    }

    const partitionCount = queuePartitionManager.getPartitionCount()
    const assignment = new Map<string, number[]>()

    for (const w of workers) assignment.set(w, [])

    for (let p = 0; p < partitionCount; p++) {
      const worker = workers[p % workers.length]!
      assignment.get(worker)!.push(p)
    }

    this.assignments.set(group_id, assignment)
  }

  // ── getGroupLag ────────────────────────────────────────────────────────────

  async getGroupLag(group_id: string, org_id?: string): Promise<number> {
    try {
      let q = supabaseAdmin
        .from('runtime_events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      if (org_id) {
        q = q.eq('org_id', org_id)
      }

      const { count, error } = await q
      if (error) throw error

      return count ?? 0
    } catch (err) {
      console.error(`[ConsumerGroupManager] getGroupLag error for group ${group_id}:`, err)
      return 0
    }
  }

  // ── getAssignments (debug/observability) ───────────────────────────────────

  getAssignments(group_id: string): Record<string, number[]> {
    const a = this.assignments.get(group_id)
    if (!a) return {}
    const result: Record<string, number[]> = {}
    for (const [worker, partitions] of a) {
      result[worker] = partitions
    }
    return result
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const consumerGroupManager = new ConsumerGroupManager()
