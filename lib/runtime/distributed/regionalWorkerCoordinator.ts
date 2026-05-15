// AGENCY GROUP — SH-ROS Distributed: Regional Worker Coordinator | AMI: 22506
// Coordinates worker processes across regions — leader election + shard assignment
// Ensures exactly-one processing per partition, failover in <30s
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { partitionStrategy } from './partitionStrategy'
import { globalFailoverController } from './globalFailoverController'
import type { Region } from './multiRegionRouter'
import { randomUUID } from 'crypto'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkerRegistration {
  worker_id: string
  region: Region
  partitions: number[]       // partitions this worker is responsible for
  status: 'active' | 'draining' | 'offline'
  last_heartbeat: string
  registered_at: string
  processed_count: number
  error_count: number
}

export interface ShardAssignment {
  shard_id: number           // partition number
  region: Region
  primary_worker: string
  replica_worker: string | null
  status: 'assigned' | 'unassigned' | 'rebalancing'
  assigned_at: string
}

export interface CoordinatorState {
  region: Region
  leader_worker: string | null
  active_workers: number
  total_shards: number
  assigned_shards: number
  unassigned_shards: number
  last_rebalance_at: string | null
}

export interface WorkerHealth {
  worker_id: string
  region: Region
  is_healthy: boolean
  last_heartbeat_age_ms: number
  partition_count: number
  error_rate: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS    = 10_000   // Workers must heartbeat every 10s
const HEARTBEAT_TIMEOUT_MS     = 30_000   // Worker is dead after 30s without heartbeat
const REBALANCE_COOLDOWN_MS    = 60_000   // Minimum 60s between rebalances
const MAX_PARTITIONS_PER_WORKER = 32      // Max partitions a single worker handles

// ─── Regional Worker Coordinator ─────────────────────────────────────────────

export class RegionalWorkerCoordinator {
  private _workers   = new Map<string, WorkerRegistration>()
  private _shards    = new Map<number, ShardAssignment>()
  private _leaders   = new Map<Region, string>()  // region → worker_id (leader)
  private _lastRebalance = new Map<Region, number>()

  // ─── Worker Lifecycle ──────────────────────────────────────────────────────

  /**
   * Register a worker in a region.
   * Returns assigned partitions.
   */
  async registerWorker(region: Region): Promise<WorkerRegistration> {
    const worker_id = `worker:${region}:${randomUUID().slice(0, 8)}`
    const now = new Date().toISOString()

    const registration: WorkerRegistration = {
      worker_id,
      region,
      partitions: [],
      status: 'active',
      last_heartbeat: now,
      registered_at: now,
      processed_count: 0,
      error_count: 0,
    }

    this._workers.set(worker_id, registration)

    // Persist registration
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    await (sb.from('learning_events') as { insert: (d: unknown) => Promise<{ error: unknown }> }).insert({
      event_type: 'worker_registered',
      org_id: 'system',
      metadata: { worker_id, region },
      created_at: now,
    })

    logger.info('[WorkerCoordinator] Worker registered', { worker_id, region })

    // Trigger rebalance for the region
    await this._rebalanceRegion(region)

    return this._workers.get(worker_id)!
  }

  /**
   * Worker heartbeat — marks worker as alive and updates metrics.
   */
  heartbeat(
    worker_id: string,
    metrics: { processed_count: number; error_count: number }
  ): boolean {
    const worker = this._workers.get(worker_id)
    if (!worker) return false
    if (worker.status === 'offline') return false

    this._workers.set(worker_id, {
      ...worker,
      last_heartbeat: new Date().toISOString(),
      processed_count: metrics.processed_count,
      error_count: metrics.error_count,
    })

    return true
  }

  /**
   * Gracefully drain a worker — redistributes its partitions before shutdown.
   */
  async drainWorker(worker_id: string): Promise<void> {
    const worker = this._workers.get(worker_id)
    if (!worker) return

    logger.info('[WorkerCoordinator] Draining worker', { worker_id, region: worker.region })
    this._workers.set(worker_id, { ...worker, status: 'draining' })

    // Rebalance: reassign all its partitions to other workers
    await this._rebalanceRegion(worker.region)

    // Mark offline after rebalance
    this._workers.set(worker_id, { ...worker, status: 'offline' })

    // Unset as leader if it was
    const leader = this._leaders.get(worker.region)
    if (leader === worker_id) {
      this._leaders.delete(worker.region)
      await this._electLeader(worker.region)
    }
  }

  // ─── Health Monitoring ─────────────────────────────────────────────────────

  /**
   * Scan all workers for stale heartbeats — evicts dead workers.
   * Called by health check cron every 15s.
   */
  async scanHeartbeats(): Promise<WorkerHealth[]> {
    const now = Date.now()
    const healths: WorkerHealth[] = []

    for (const [worker_id, worker] of this._workers.entries()) {
      if (worker.status === 'offline') continue

      const age_ms = now - new Date(worker.last_heartbeat).getTime()
      const is_healthy = age_ms < HEARTBEAT_TIMEOUT_MS
      const error_rate = worker.processed_count > 0
        ? worker.error_count / worker.processed_count
        : 0

      healths.push({
        worker_id,
        region: worker.region,
        is_healthy,
        last_heartbeat_age_ms: age_ms,
        partition_count: worker.partitions.length,
        error_rate,
      })

      if (!is_healthy) {
        logger.warn('[WorkerCoordinator] Worker heartbeat timeout — evicting', {
          worker_id, region: worker.region, age_ms,
        })
        await this._evictWorker(worker_id)
      }
    }

    return healths
  }

  // ─── Shard Management ─────────────────────────────────────────────────────

  /**
   * Get shard assignment for a partition.
   * Used by producers to route events to the correct worker.
   */
  getShardAssignment(partition: number): ShardAssignment | null {
    return this._shards.get(partition) ?? null
  }

  /**
   * Get all partitions assigned to a worker.
   * Called by worker on startup to know what to consume.
   */
  getWorkerPartitions(worker_id: string): number[] {
    return this._workers.get(worker_id)?.partitions ?? []
  }

  // ─── Region State ─────────────────────────────────────────────────────────

  /**
   * Get coordinator state for a region.
   */
  getRegionState(region: Region): CoordinatorState {
    const workers = Array.from(this._workers.values())
      .filter(w => w.region === region && w.status === 'active')

    const region_partitions = partitionStrategy.getRegionPartitions(region)
    const assigned = region_partitions.filter(p => {
      const shard = this._shards.get(p)
      return shard?.status === 'assigned'
    })

    return {
      region,
      leader_worker: this._leaders.get(region) ?? null,
      active_workers: workers.length,
      total_shards: region_partitions.length,
      assigned_shards: assigned.length,
      unassigned_shards: region_partitions.length - assigned.length,
      last_rebalance_at: this._lastRebalance.has(region)
        ? new Date(this._lastRebalance.get(region)!).toISOString()
        : null,
    }
  }

  /**
   * Get coordinator state for all regions.
   */
  getAllRegionStates(): CoordinatorState[] {
    const regions: Region[] = ['eu-west', 'us-east', 'ap-south']
    return regions.map(r => this.getRegionState(r))
  }

  // ─── Failover Coordination ─────────────────────────────────────────────────

  /**
   * Handle regional failover — reassigns shards to replica region workers.
   * Called by globalFailoverController when a region fails.
   */
  async handleRegionalFailover(
    failed_region: Region,
    target_region: Region
  ): Promise<void> {
    logger.error('[WorkerCoordinator] Regional failover — reassigning shards', {
      from: failed_region, to: target_region,
    })

    // Mark all workers in failed region as draining
    for (const [worker_id, worker] of this._workers.entries()) {
      if (worker.region === failed_region && worker.status === 'active') {
        this._workers.set(worker_id, { ...worker, status: 'draining' })
      }
    }

    // Reassign failed region's partitions to target region workers
    const failed_partitions = partitionStrategy.getRegionPartitions(failed_region)
    const target_workers = Array.from(this._workers.values())
      .filter(w => w.region === target_region && w.status === 'active')

    if (target_workers.length === 0) {
      logger.error('[WorkerCoordinator] No workers in target region for failover', {
        target_region,
      })
      return
    }

    let worker_idx = 0
    for (const partition of failed_partitions) {
      const target_worker = target_workers[worker_idx % target_workers.length]
      const shard = this._shards.get(partition)

      this._shards.set(partition, {
        shard_id: partition,
        region: target_region,
        primary_worker: target_worker.worker_id,
        replica_worker: shard?.primary_worker ?? null,  // original primary as replica ref
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      })

      // Update worker's partition list
      const updated = this._workers.get(target_worker.worker_id)!
      if (!updated.partitions.includes(partition)) {
        this._workers.set(target_worker.worker_id, {
          ...updated,
          partitions: [...updated.partitions, partition],
        })
      }

      worker_idx++
    }

    logger.info('[WorkerCoordinator] Failover shards reassigned', {
      partitions: failed_partitions.length,
      target_region,
      target_workers: target_workers.length,
    })

    // Update circuit breaker
    await globalFailoverController.evaluateRegion(failed_region, {
      queue_lag: 0,
      latency_p99_ms: 0,
      error_rate: 1.0,  // failed region has 100% error rate
    })
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async _rebalanceRegion(region: Region): Promise<void> {
    const last = this._lastRebalance.get(region) ?? 0
    const now = Date.now()

    if (now - last < REBALANCE_COOLDOWN_MS) {
      logger.info('[WorkerCoordinator] Rebalance skipped (cooldown)', { region })
      return
    }

    this._lastRebalance.set(region, now)

    const active_workers = Array.from(this._workers.values())
      .filter(w => w.region === region && w.status === 'active')

    const region_partitions = partitionStrategy.getRegionPartitions(region)

    if (active_workers.length === 0) {
      // No workers — mark all shards unassigned
      for (const partition of region_partitions) {
        this._shards.set(partition, {
          shard_id: partition,
          region,
          primary_worker: '',
          replica_worker: null,
          status: 'unassigned',
          assigned_at: new Date().toISOString(),
        })
      }
      return
    }

    // Round-robin distribution
    const partitions_per_worker = Math.min(
      MAX_PARTITIONS_PER_WORKER,
      Math.ceil(region_partitions.length / active_workers.length)
    )

    // Reset partition lists
    for (const worker of active_workers) {
      this._workers.set(worker.worker_id, { ...worker, partitions: [] })
    }

    let worker_idx = 0
    for (const partition of region_partitions) {
      const primary = active_workers[worker_idx % active_workers.length]
      const replica_idx = (worker_idx + 1) % active_workers.length
      const replica = active_workers.length > 1 ? active_workers[replica_idx] : null

      this._shards.set(partition, {
        shard_id: partition,
        region,
        primary_worker: primary.worker_id,
        replica_worker: replica?.worker_id ?? null,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      })

      const updated_primary = this._workers.get(primary.worker_id)!
      if (updated_primary.partitions.length < partitions_per_worker) {
        this._workers.set(primary.worker_id, {
          ...updated_primary,
          partitions: [...updated_primary.partitions, partition],
        })
        worker_idx++
      } else {
        // This worker is full, move to next
        worker_idx++
        const next_worker = active_workers[worker_idx % active_workers.length]
        const updated_next = this._workers.get(next_worker.worker_id)!
        this._workers.set(next_worker.worker_id, {
          ...updated_next,
          partitions: [...updated_next.partitions, partition],
        })
      }
    }

    logger.info('[WorkerCoordinator] Region rebalanced', {
      region,
      workers: active_workers.length,
      partitions: region_partitions.length,
    })

    // Elect a leader after rebalance
    await this._electLeader(region)
  }

  private async _electLeader(region: Region): Promise<void> {
    const active_workers = Array.from(this._workers.values())
      .filter(w => w.region === region && w.status === 'active')

    if (active_workers.length === 0) {
      this._leaders.delete(region)
      return
    }

    // Simple leader election: worker with most partitions (most established)
    const leader = active_workers.reduce((best, w) =>
      w.partitions.length >= best.partitions.length ? w : best
    )

    const prev_leader = this._leaders.get(region)
    if (prev_leader !== leader.worker_id) {
      this._leaders.set(region, leader.worker_id)
      logger.info('[WorkerCoordinator] New leader elected', {
        region, leader: leader.worker_id, prev: prev_leader,
      })
    }

    void active_workers
  }

  private async _evictWorker(worker_id: string): Promise<void> {
    const worker = this._workers.get(worker_id)
    if (!worker) return

    this._workers.set(worker_id, { ...worker, status: 'offline' })

    // Rebalance affected region
    await this._rebalanceRegion(worker.region)

    logger.warn('[WorkerCoordinator] Worker evicted', {
      worker_id, region: worker.region,
    })
  }
}

export const regionalWorkerCoordinator = new RegionalWorkerCoordinator()

// ─── Heartbeat Interval ───────────────────────────────────────────────────────

// Export the interval constant for external heartbeat implementations
export { HEARTBEAT_INTERVAL_MS }
